"""JSON API over core.py for the React front end, which it also serves from web/dist."""
import io
import json
import os
import re
import threading
from datetime import date
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

import auth as admin_auth
import core
import invoice_pdf
import lookups

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def money(v) -> str:
    return f"£{v:,.2f}"


def bad(msg: str, status: int = 400):
    raise HTTPException(status, msg)


# ---------------------------------------------------------------- request bodies

class LoginIn(BaseModel):
    email: str = ""
    password: str = ""


class BusinessIn(BaseModel):
    company_number: str = ""
    company_name: str = ""
    company_status: str = ""
    registered_office: str = ""
    sic_codes: str = ""
    incorporation_date: str = ""
    directors: str = ""
    vrn: str = ""
    stagger: str = "MAR"
    vat_reg_date: date | None = None
    accounting_scheme: str = core.ACCOUNTING_SCHEMES[0]
    uses_margin_scheme: bool = True
    trading_name: str = ""
    email: str = ""
    phone: str = ""
    sort_code: str = ""
    account_no: str = ""
    invoice_start: int | None = None
    stock_start: int | None = None
    year_end: str = ""


class CarIn(BaseModel):
    reg: str
    make_model: str = ""
    scheme: str = core.MARGIN
    purchase_date: date
    purchase_price: float
    purchase_vat: float | None = None
    purchase_invoice_no: str = ""
    seller_name: str = ""
    colour: str = ""
    first_reg: date | None = None
    mileage: str = ""


class CarsSave(BaseModel):
    rows: list[dict]
    shown_ids: list[int]


class SaleIn(BaseModel):
    sale_date: date
    sale_price: float
    px_allowance: float | None = None
    px_reg: str = ""
    px_make_model: str = ""


class PreviewIn(BaseModel):
    car_id: int
    sale_price: float


class TxnEdit(BaseModel):
    id: int
    category: str
    vat: float | None = None
    notes: str = ""


class Rule(BaseModel):
    keyword: str
    category: str


class FiledIn(BaseModel):
    filed_on: date


class ExpenseIn(BaseModel):
    date: date
    description: str
    amount: float
    expense_type: str
    paid_by: str = "Cash"
    vat: float | None = None
    car_id: int | None = None
    notes: str = ""
    refund: bool = False


class CreditNoteIn(BaseModel):
    kind: str
    credit_date: date
    amount: float | None = None
    reason: str = ""


class PaymentIn(BaseModel):
    paid_on: date
    amount: float
    method: str = ""
    note: str = ""


# ---------------------------------------------------------------- app

def create_app(db_path: str | None = None, auth: "admin_auth.Auth | None" = None) -> FastAPI:
    """The admin API and page. With `auth`, every /api call except signing in needs the session
    cookie; build_app (what runs online) always passes it."""
    app = FastAPI(title="VAT Return", docs_url=None, redoc_url=None, openapi_url=None)
    conn = core.connect(db_path)
    # The uploaded logo is business data, so it sits in the data folder with the database.
    invoice_pdf.DEFAULT_LOGO = core.receipts_dir(conn).parent / "logo.png"
    lock = threading.Lock()  # one SQLite connection shared by FastAPI's worker threads

    # ---------------------------------------------------------------- sign in
    open_paths = {"/api/auth/login", "/api/auth/me", "/api/auth/logout", "/api/version"}

    def local_path(request: Request) -> str:
        path, root = request.scope["path"], request.scope.get("root_path", "")
        return path[len(root):] if root and path.startswith(root) else path

    def client_id(request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for", "")
        return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")

    if auth is not None:
        @app.middleware("http")
        async def require_login(request: Request, call_next):
            path = local_path(request)
            if path.startswith("/api/") and path not in open_paths                     and not auth.session_ok(request.cookies.get(admin_auth.COOKIE)):
                return JSONResponse({"detail": "Please sign in."}, status_code=401)
            return await call_next(request)

    @app.get("/api/auth/me")
    def auth_me(request: Request):
        if auth is None:
            return {"signed_in": True, "required": False}
        return {"signed_in": auth.session_ok(request.cookies.get(admin_auth.COOKIE)), "required": True,
                "configured": auth.configured}

    @app.post("/api/auth/login")
    def auth_login(body: LoginIn, request: Request):
        if auth is None:
            return {"ok": True}
        if not auth.configured:
            bad("Sign-in isn't set up yet: add ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET.", 503)
        who = client_id(request)
        # This device after 5 wrong tries, and every device together after 20 (so changing IP doesn't help).
        for key, limit in ((who, admin_auth.MAX_FAILS), ("*", admin_auth.MAX_FAILS * 4)):
            wait = auth.locked_for(key, limit)
            if wait:
                bad(f"Too many wrong tries. Try again in {max(1, round(wait / 60))} minutes.", 429)
        if not auth.login(who, body.email, body.password):
            auth.record_fail("*")
            bad("Wrong email or password.", 401)
        res = JSONResponse({"ok": True})
        secure = request.headers.get("x-forwarded-proto") == "https" or os.environ.get("COOKIE_SECURE") == "1"
        res.set_cookie(admin_auth.COOKIE, auth.make_session(), max_age=admin_auth.SESSION_HOURS * 3600,
                       httponly=True, secure=secure, samesite="strict", path="/admin")
        return res

    @app.post("/api/auth/logout")
    def auth_logout():
        res = JSONResponse({"ok": True})
        res.delete_cookie(admin_auth.COOKIE, path="/admin")
        return res
    hmrc_confirmed: set[str] = set()  # VRNs HMRC has confirmed while the server has been running

    def db():
        with lock:
            yield conn

    def biz(conn) -> dict:
        b = core.get_business(conn)
        if not b:
            bad("Set up the business first.", 409)
        return b

    def quarter(conn, q: str) -> core.Quarter:
        try:
            start = date.fromisoformat(q)
        except ValueError:
            bad("Unknown quarter.")
        return core.quarter_for(start, biz(conn)["stagger"])

    def csv_response(data: bytes, name: str, kind: str = "text/csv") -> Response:
        return Response(data, media_type=kind,
                        headers={"Content-Disposition": f'attachment; filename="{name}"'})

    # ---------------------------------------------------------------- reference data

    # The code and web page as they were when this server started. If either changes on disk, the
    # running server is out of date (it doesn't reload), so the page asks for a restart.
    here = Path(__file__).parent
    watched = [here / "core.py", here / "server.py", DIST / "index.html"]
    stamp = lambda: [f.stat().st_mtime if f.exists() else 0 for f in watched]  # noqa: E731
    started = stamp()

    @app.get("/api/version")
    def version():
        return {"stale": stamp() != started}

    @app.get("/api/meta")
    def meta():
        return {
            "categories": core.CATEGORIES, "uncategorised": core.UNCATEGORISED,
            "expense_vat": core.EXPENSE_VAT, "car_schemes": core.CAR_SCHEMES,
            "staggers": core.STAGGERS, "accounting_schemes": core.ACCOUNTING_SCHEMES,
            "box_labels": core.BOX_LABELS, "receipt_types": core.RECEIPT_TYPES,
            "starter_rules": core.STARTER_RULES, "today": date.today(),
            "car_statuses": core.CAR_STATUSES, "car_stages": core.CAR_STAGES,
            "expense_types": [{"name": k, "vat": v == core.EXPENSE_VAT} for k, v in core.EXPENSE_TYPES.items()],
            "paid_by": core.PAID_BY,
            "lookups": {"companies_house": lookups.companies_house_available(),
                        "hmrc": lookups.hmrc_available(), "hmrc_sandbox": lookups.hmrc_sandbox(),
                        "dvla": lookups.dvla_available(), "mot": lookups.mot_available()},
        }

    # ---------------------------------------------------------------- business

    @app.get("/api/business")
    def get_business(conn=Depends(db)):
        b = core.get_business(conn)
        if b:
            b["uses_margin_scheme"] = bool(b.get("uses_margin_scheme"))
            b["vrn_formatted"] = core.format_vrn(b["vrn"])
            b["numbers_locked"] = core.has_invoices(conn)
            b["next_invoice_no"] = core.next_invoice_no(conn)
            b["next_stock_no"] = core.next_stock_no(conn)
            b["has_logo"] = invoice_pdf.DEFAULT_LOGO.exists()
        return b

    @app.put("/api/business")
    def save_business(body: BusinessIn, conn=Depends(db)):
        vrn = core.normalise_vrn(body.vrn)
        problems = []
        if not body.company_name.strip():
            problems.append("Company name is required.")
        if not core.vrn_shape_ok(vrn):
            problems.append("VAT number must be 9 digits (or 12 with a branch code).")
        elif not core.vrn_checksum_ok(vrn) and vrn not in hmrc_confirmed:
            problems.append("VAT number fails the check-digit test. Verify it with HMRC or correct it.")
        if not body.vat_reg_date:
            problems.append("VAT effective registration date is required.")
        if body.stagger not in core.STAGGERS:
            problems.append("Pick a VAT stagger.")
        if problems:
            bad(" ".join(problems))
        data = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}
        data["company_number"] = lookups.normalise_company_number(data["company_number"])
        data["vrn"] = vrn
        data["vat_reg_date"] = body.vat_reg_date.isoformat()
        data["uses_margin_scheme"] = 1 if body.uses_margin_scheme else 0
        if data["year_end"] and not re.fullmatch(r"(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])", data["year_end"]):
            bad("Enter the year end as month and day, e.g. 03-31.")
        for f in ("invoice_start", "stock_start"):
            if data[f] is not None and not 1 <= data[f] <= 9999:
                bad("Invoice and stock numbers run from 1 to 9999.")
        try:
            core.save_business(conn, data)
        except ValueError as e:
            bad(str(e))
        return get_business(conn)

    @app.get("/api/logo")
    def get_logo():
        if not invoice_pdf.DEFAULT_LOGO.exists():
            bad("No logo uploaded.", 404)
        return FileResponse(invoice_pdf.DEFAULT_LOGO, headers={"Cache-Control": "no-store"})

    @app.post("/api/logo")
    def upload_logo(file: UploadFile = File(...), conn=Depends(db)):
        try:
            img = Image.open(io.BytesIO(file.file.read()))
            img.load()
        except Exception:  # anything PIL can't read
            bad("That file isn't an image. Upload a PNG or JPG logo.")
        logo = invoice_pdf.DEFAULT_LOGO
        logo.parent.mkdir(parents=True, exist_ok=True)
        core.fit_logo(img).save(logo, format="PNG")
        if logo.resolve().is_relative_to(conn.files_dir.resolve()):  # keep it in the database too
            core.store_file(conn, logo)
        return {"message": "Logo saved. Re-generate any existing invoices to use it."}

    @app.get("/api/vrn-check")
    def vrn_check(vrn: str):
        v = core.normalise_vrn(vrn)
        return {"vrn": v, "shape_ok": core.vrn_shape_ok(v), "checksum_ok": core.vrn_checksum_ok(v),
                "hmrc_confirmed": v in hmrc_confirmed, "formatted": core.format_vrn(v)}

    @app.post("/api/lookup/companies-house")
    def ch_lookup(body: dict):
        try:
            return lookups.companies_house_lookup(body.get("company_number", ""))
        except lookups.LookupFailed as e:
            bad(str(e))

    @app.post("/api/lookup/hmrc")
    def hmrc_lookup(body: dict):
        try:
            result = lookups.hmrc_check_vat_number(body.get("vrn", ""))
        except lookups.LookupFailed as e:
            bad(str(e))
        hmrc_confirmed.add(core.normalise_vrn(result["vrn"]))
        name = body.get("company_name") or ""
        result["name_matches"] = not name or lookups.names_match(result["name"], name)
        return result

    # ---------------------------------------------------------------- quarters and return

    @app.get("/api/quarters")
    def quarters(conn=Depends(db)):
        b, today = biz(conn), date.today()
        reg = core.business_start(b) or core.to_date(b["vat_reg_date"])
        qs = core.recent_quarters(b["stagger"], today, reg) or [core.quarter_for(reg, b["stagger"])]
        out = []
        for q in qs:
            deadline, filing = core.filing_deadline(q), core.get_filing(conn, q)
            if filing:
                status = "filed"
            elif q.contains(today):
                status = "in_progress"
            elif today <= deadline:
                status = "due"
            else:
                status = "overdue"
            out.append({"id": q.start, "start": q.start, "end": q.end, "label": q.label,
                        "deadline": deadline, "status": status,
                        "filed_on": filing["filed_on"] if filing else None})
        return jsonable_encoder(out)

    @app.get("/api/return")
    def vat_return(q: str, conn=Depends(db)):
        qq = quarter(conn, q)
        r = core.calculate_return(conn, qq)
        p = core.quarter_progress(conn, qq)
        today = date.today()
        return jsonable_encoder({
            "quarter": {"id": qq.start, "label": qq.label, "start": qq.start, "end": qq.end},
            "deadline": core.filing_deadline(qq), "in_progress": qq.contains(today),
            "ended": today > qq.end, "filed_on": r.filed_on,
            "boxes": {n: r.box_str(n) for n in range(1, 10)}, "net": r.boxes[5],
            "registered": r.registered, "vat_from": r.vat_from,
            "warnings": r.warnings, "cars_sold": r.cars_sold, "detail": r.detail,
            "progress": {"total": p.total, "categorised": p.categorised,
                         "receipts_needed": p.receipts_needed, "receipts_attached": p.receipts_attached,
                         "money_in": p.money_in, "money_out": p.money_out, "fraction": p.fraction},
        })

    @app.post("/api/filing")
    def mark_filed(q: str, body: FiledIn, conn=Depends(db)):
        qq = quarter(conn, q)
        if date.today() <= qq.end:
            bad("You can file once the quarter has ended.")
        if body.filed_on > date.today():
            bad("The filing date can't be in the future.")
        try:
            core.mark_filed(conn, qq, body.filed_on)
        except ValueError as e:
            bad(str(e))
        return {"ok": True}

    @app.delete("/api/filing")
    def unmark_filed(q: str, conn=Depends(db)):
        core.unmark_filed(conn, quarter(conn, q))
        return {"ok": True}

    @app.get("/api/export/quarter.csv")
    def export_quarter(q: str, conn=Depends(db)):
        qq = quarter(conn, q)
        return csv_response(core.export_quarter_csv(conn, qq), f"vat_{qq.label.replace(' ', '_')}.csv")

    @app.get("/api/export/boxes.csv")
    def export_boxes(q: str, conn=Depends(db)):
        qq = quarter(conn, q)
        return csv_response(core.bridging_csv(core.calculate_return(conn, qq)),
                            f"vat_boxes_{qq.label.replace(' ', '_')}.csv")

    @app.get("/api/export/receipts.zip")
    def export_receipts(q: str, conn=Depends(db)):
        qq = quarter(conn, q)
        data = core.receipts_zip(conn, qq)
        if not data:
            bad("No receipts attached this quarter.", 404)
        return csv_response(data, f"receipts_{qq.label.replace(' ', '_')}.zip", "application/zip")

    @app.get("/api/backup.zip")
    def backup(conn=Depends(db)):
        return csv_response(core.backup_zip(conn), f"vat_backup_{date.today():%Y-%m-%d}.zip",
                            "application/zip")

    # ---------------------------------------------------------------- stock book

    @app.get("/api/cars")
    def cars(conn=Depends(db)):
        return jsonable_encoder(core.list_cars(conn))

    @app.post("/api/cars")
    def add_car(body: CarIn, conn=Depends(db)):
        if not body.reg.strip():
            bad("Enter the reg.")
        if body.purchase_price <= 0:
            bad("Enter the purchase price.")
        if body.scheme not in core.CAR_SCHEMES:
            bad("Pick Margin or Standard.")
        if body.scheme == core.STANDARD and not (body.purchase_vat or 0) > 0:
            bad("Enter the purchase VAT for a Standard car, or choose Margin.")
        car_id = core.add_car(conn, body.reg, body.make_model, body.scheme, body.purchase_date,
                              body.purchase_price, body.purchase_vat if body.scheme == core.STANDARD else None,
                              purchase_invoice_no=body.purchase_invoice_no, seller_name=body.seller_name,
                              colour=body.colour, first_reg=body.first_reg, mileage=body.mileage)
        core.match_car_payments(conn)
        return {"message": f"{body.reg.strip().upper()} added to stock.", "id": car_id}

    @app.put("/api/cars")
    def save_cars(body: CarsSave, conn=Depends(db)):
        try:
            n = core.save_cars(conn, body.rows, shown_ids=set(body.shown_ids))
        except ValueError as e:
            bad(str(e))
        core.match_car_payments(conn)
        return {"message": f"Stock book saved ({plural(n, 'car')} shown)."}

    def stock_car(conn, car_id: int) -> dict:
        car = next((c for c in core.list_cars(conn) if c["id"] == car_id), None)
        if not car:
            bad("Car not found.", 404)
        return car

    @app.post("/api/sale-preview")
    def sale_preview(body: PreviewIn, conn=Depends(db)):
        car = stock_car(conn, body.car_id)
        vat, margin, profit = core.sale_figures(car["scheme"], car["purchase_price"],
                                                car["purchase_vat"], core.dec(body.sale_price))
        return jsonable_encoder({"vat": vat, "margin": margin, "profit": profit})

    @app.post("/api/cars/{car_id}/sale")
    def record_sale(car_id: int, body: SaleIn, conn=Depends(db)):
        car = stock_car(conn, car_id)
        px = body.px_allowance or 0
        if body.sale_price <= 0:
            bad("Enter the sale price.")
        if car["purchase_date"] and body.sale_date < car["purchase_date"]:
            bad("The sale date is before the purchase date.")
        if px > 0 and not body.px_reg.strip():
            bad("Enter the part-ex car's reg.")
        if px > body.sale_price:
            bad("The part-ex allowance can't be more than the sale price, which should include it.")
        core.record_sale(conn, car_id, body.sale_date, body.sale_price, px or None,
                         body.px_reg, body.px_make_model)
        msg = f"{car['reg']} recorded as sold for {money(core.dec(body.sale_price))}."
        if px > 0:
            msg += f" {body.px_reg.strip().upper()} added to stock as a part-exchange."
        return {"message": msg}

    @app.get("/api/stock")
    def stock(conn=Depends(db)):
        return jsonable_encoder(core.car_overview(conn))

    @app.get("/api/home")
    def home(p: str = "", conn=Depends(db)):
        biz(conn)
        return jsonable_encoder(core.home_summary(conn, period=period(conn, p) if p else None))

    @app.patch("/api/cars/{car_id}")
    def update_car(car_id: int, body: dict, conn=Depends(db)):
        try:
            car = core.update_car(conn, car_id, body)
        except ValueError as e:
            bad(str(e))
        return {"message": f"{car['reg']} saved."}

    @app.get("/api/vehicle-lookup")
    def vehicle_lookup(reg: str):
        try:
            return jsonable_encoder(lookups.vehicle_lookup(reg))
        except lookups.LookupFailed as e:
            bad(str(e))

    @app.post("/api/cars/{car_id}/check")
    def check_car(car_id: int, conn=Depends(db)):
        car = stock_car(conn, car_id)
        try:
            result = lookups.vehicle_lookup(car["reg"] or "")
            core.apply_vehicle_check(conn, car_id, result)
        except (lookups.LookupFailed, ValueError) as e:
            bad(str(e))
        warn = result["mileage_warnings"]
        msg = f"{car['reg']} checked with the DVLA and DVSA." if not result["errors"] else \
            f"{car['reg']} checked. {' '.join(result['errors'])}"
        return jsonable_encoder({"message": msg, "warnings": warn, "result": result})

    @app.get("/api/reminders")
    def reminders(conn=Depends(db)):
        return jsonable_encoder(core.reminders(conn))

    @app.get("/api/cars/{car_id}/documents")
    def car_documents(car_id: int, conn=Depends(db)):
        return core.list_car_documents(conn, car_id)

    @app.post("/api/cars/{car_id}/documents")
    def add_car_documents(car_id: int, files: list[UploadFile] = File(...), kind: str = Form("Purchase invoice"),
                          conn=Depends(db)):
        for f in files:
            if Path(f.filename or "").suffix.lower().lstrip(".") not in core.RECEIPT_TYPES:
                bad(f"{f.filename}: documents must be {', '.join(core.RECEIPT_TYPES)}.")
        try:
            for f in files:
                core.add_car_document(conn, car_id, kind, f.filename, f.file.read())
        except ValueError as e:
            bad(str(e))
        return {"message": f"Kept {plural(len(files), 'document')} with the car."}

    @app.get("/api/documents/{doc_id}/file")
    def car_document_file(doc_id: int, conn=Depends(db)):
        row = conn.execute("SELECT * FROM car_documents WHERE id = ?", (doc_id,)).fetchone()
        path = core.documents_dir(conn) / row["path"] if row else None
        if not path or not path.exists():
            bad("Document not found.", 404)
        return FileResponse(path, filename=row["filename"], content_disposition_type="inline")

    @app.delete("/api/documents/{doc_id}")
    def delete_car_document(doc_id: int, conn=Depends(db)):
        core.delete_car_document(conn, doc_id)
        return {"ok": True}

    @app.get("/api/reconciliation")
    def reconciliation(q: str, conn=Depends(db)):
        rec = core.car_reconciliation(conn, quarter(conn, q))
        rec["unlinked_txns"] = [{**t, "amount": core.dec(t["amount"])} for t in rec["unlinked_txns"]]
        return jsonable_encoder(rec)

    # ---------------------------------------------------------------- bank

    def period(conn, p: str) -> core.Period:
        biz(conn)
        try:
            return core.period_by_id(conn, p)
        except ValueError as e:
            bad(str(e))

    @app.get("/api/periods")
    def periods(conn=Depends(db)):
        biz(conn)
        return jsonable_encoder({"kinds": core.PERIOD_KINDS,
                                 "options": {k: [vars(x) for x in v] for k, v in core.period_options(conn).items()}})

    @app.get("/api/period-summary")
    def period_summary(p: str, conn=Depends(db)):
        return jsonable_encoder(core.period_summary(conn, period(conn, p)))

    @app.get("/api/transactions")
    def transactions(q: str = "", p: str = "", conn=Depends(db)):
        df = core.get_transactions_df(conn, period(conn, p) if p else quarter(conn, q))
        links = {r["id"]: r["car_id"] for r in conn.execute("SELECT id, car_id FROM transactions")}
        regs = {r["id"]: r["reg"] for r in conn.execute("SELECT id, reg FROM cars")}
        paid = {r["txn_id"]: (r["invoice_id"], r["invoice_no"]) for r in conn.execute(
            "SELECT p.txn_id, p.invoice_id, i.invoice_no FROM invoice_payments p "
            "JOIN invoices i ON i.id = p.invoice_id WHERE p.txn_id IS NOT NULL")}
        rows = []
        for t in df.to_dict("records"):
            car_id = links.get(t["id"])
            inv = paid.get(t["id"])
            rows.append({**t, "car_id": car_id, "car_reg": regs.get(car_id),
                         "invoice_id": inv[0] if inv else None, "invoice_no": inv[1] if inv else None})
        return jsonable_encoder(rows)

    @app.patch("/api/transactions")
    def update_transactions(edits: list[TxnEdit], conn=Depends(db)):
        df = pd.DataFrame([e.model_dump() for e in edits], columns=["id", "category", "vat", "notes"])
        df["vat"] = df["vat"].astype(object).where(df["vat"].notna(), None)
        n = core.update_transactions(conn, df)
        return {"message": f"Saved changes to {plural(n, 'transaction')}."}

    @app.get("/api/expenses")
    def expenses(p: str, conn=Depends(db)):
        return jsonable_encoder(core.expenses(conn, period(conn, p)))

    @app.post("/api/expenses")
    def add_expense(body: ExpenseIn, conn=Depends(db)):
        try:
            txn = core.add_expense(conn, body.date, body.description, body.amount, body.expense_type,
                                   body.paid_by, body.vat, body.car_id, body.notes, body.refund)
        except ValueError as e:
            bad(str(e))
        return {"message": f"Expense added: {body.description.strip()} {money(core.dec(body.amount))}.", "id": txn}

    @app.get("/api/expenses/{txn_id}")
    def get_expense(txn_id: int, conn=Depends(db)):
        try:
            return jsonable_encoder(core.get_expense(conn, txn_id))
        except ValueError as e:
            raise HTTPException(404, str(e))

    @app.patch("/api/expenses/{txn_id}")
    def update_expense(txn_id: int, body: dict, conn=Depends(db)):
        try:
            if set(body) <= {"expense_type", "car_id"}:  # quick edits from the list
                if "expense_type" in body:
                    core.set_expense_type(conn, txn_id, body["expense_type"] or None)
                if "car_id" in body:
                    core.link_transaction(conn, txn_id, int(body["car_id"]) if body["car_id"] else None)
            else:
                core.update_expense(conn, txn_id, body)
        except ValueError as e:
            bad(str(e))
        return {"message": "Expense saved."}

    @app.delete("/api/expenses/{txn_id}")
    def delete_expense(txn_id: int, conn=Depends(db)):
        try:
            core.delete_expense(conn, txn_id)
        except ValueError as e:
            bad(str(e))
        return {"message": "Expense deleted."}

    @app.post("/api/transactions/{txn_id}/link")
    def link_transaction(txn_id: int, body: dict, conn=Depends(db)):
        car_id = body.get("car_id")
        try:
            core.link_transaction(conn, txn_id, int(car_id) if car_id else None)
        except ValueError as e:
            bad(str(e))
        return {"message": "Linked to the car." if car_id else "Unlinked from the car."}

    @app.post("/api/transactions/{txn_id}/pay-invoice")
    def pay_invoice(txn_id: int, body: dict, conn=Depends(db)):
        try:
            core.pay_invoice_from_bank(conn, txn_id, int(body.get("invoice_id") or 0))
        except ValueError as e:
            bad(str(e))
        return {"message": "Recorded as a payment against the invoice."}

    @app.post("/api/transactions/auto-categorise")
    def auto_categorise(conn=Depends(db)):
        n = core.auto_categorise(conn)
        return {"message": f"Categorised {plural(n, 'transaction')}.", "count": n}

    def read_csv(upload: UploadFile) -> pd.DataFrame:
        try:
            return core.read_bank_csv(upload.file.read())
        except Exception as e:  # malformed CSV of any kind
            bad(f"Couldn't read that CSV: {e}")

    @app.post("/api/import/preview")
    def import_preview(file: UploadFile = File(...)):
        raw = read_csv(file)
        return jsonable_encoder({
            "columns": list(raw.columns), "guess": core.detect_columns(list(raw.columns)),
            "rows": len(raw), "preview": raw.head(5).astype(str).to_dict("records")})

    @app.post("/api/import")
    def import_csv(file: UploadFile = File(...), mapping: str = Form(...), conn=Depends(db)):
        raw = read_csv(file)
        m = {k: (v or None) for k, v in json.loads(mapping).items()}
        if not m.get("date") or not (m.get("amount") or m.get("paid_in") or m.get("paid_out")):
            bad("Pick a date column and either paid in / paid out or a signed amount.")
        res = core.import_transactions(conn, raw, m)
        return {"message": f"Added {plural(res.added, 'transaction')} ({res.categorised} categorised "
                           f"automatically, {plural(res.cars_matched, 'car payment')} matched to the "
                           f"stock book), skipped {res.skipped} already imported.",
                "failed": res.failed}

    # ---------------------------------------------------------------- receipts

    @app.get("/api/transactions/{txn_id}/receipts")
    def receipts(txn_id: int, conn=Depends(db)):
        return [{"id": r["id"], "filename": r["filename"], "uploaded_at": r["uploaded_at"]}
                for r in core.list_receipts(conn, txn_id)]

    @app.post("/api/transactions/{txn_id}/receipts")
    def add_receipts(txn_id: int, files: list[UploadFile] = File(...), conn=Depends(db)):
        for f in files:
            ext = Path(f.filename or "").suffix.lower().lstrip(".")
            if ext not in core.RECEIPT_TYPES:
                bad(f"{f.filename}: receipts must be {', '.join(core.RECEIPT_TYPES)}.")
        for f in files:
            core.add_receipt(conn, txn_id, f.filename, f.file.read())
        return {"message": f"Attached {plural(len(files), 'receipt')}."}

    @app.get("/api/receipts/{receipt_id}/file")
    def receipt_file(receipt_id: int, conn=Depends(db)):
        row = conn.execute("SELECT * FROM receipts WHERE id = ?", (receipt_id,)).fetchone()
        path = core.receipts_dir(conn) / row["path"] if row else None
        if not path or not path.exists():
            bad("Receipt not found.", 404)
        return FileResponse(path, filename=row["filename"])

    @app.delete("/api/receipts/{receipt_id}")
    def delete_receipt(receipt_id: int, conn=Depends(db)):
        core.delete_receipt(conn, receipt_id)
        return {"ok": True}

    # ---------------------------------------------------------------- invoices

    def invoice_or_404(conn, invoice_id: int) -> dict:
        inv = core.get_invoice(conn, invoice_id)
        if not inv:
            bad("Invoice not found.", 404)
        return inv

    def invoice_out(conn, inv: dict) -> dict:
        path = core.invoice_path(conn, inv)
        return jsonable_encoder({**inv, "pdf_exists": bool(path and path.exists()),
                                 "payment": core.payment_status(conn, inv),
                                 "credit_notes": core.list_credit_notes(conn, inv["id"])})

    def invoice_call(conn, fn, *args) -> dict:
        try:
            return invoice_out(conn, fn(conn, *args))
        except ValueError as e:
            bad(str(e))

    @app.get("/api/invoices")
    def invoices(conn=Depends(db)):
        return [invoice_out(conn, inv) for inv in core.list_invoices(conn)]

    @app.get("/api/invoices/customers")
    def invoice_customers(conn=Depends(db)):
        return core.customers(conn)

    @app.get("/api/invoices/{invoice_id}/payments")
    def payments(invoice_id: int, conn=Depends(db)):
        inv = invoice_or_404(conn, invoice_id)
        return jsonable_encoder({"payments": core.invoice_payments(conn, invoice_id),
                                 **core.payment_status(conn, inv)})

    @app.post("/api/invoices/{invoice_id}/payments")
    def add_payment(invoice_id: int, body: PaymentIn, conn=Depends(db)):
        try:
            core.add_payment(conn, invoice_id, body.paid_on, body.amount, body.method, body.note)
        except ValueError as e:
            bad(str(e))
        return {"message": f"Payment of {money(core.dec(body.amount))} recorded."}

    @app.post("/api/invoices/{invoice_id}/credit-notes")
    def create_credit_note(invoice_id: int, body: CreditNoteIn, conn=Depends(db)):
        try:
            cn = core.create_credit_note(conn, invoice_id, body.kind, body.credit_date, body.amount, body.reason)
        except ValueError as e:
            bad(str(e))
        what = "the car is back in stock" if cn["kind"] == "return" else "the price is reduced"
        return jsonable_encoder({**cn, "message": f"Credit note {cn['credit_no']} issued for {money(cn['amount'])}; {what}."})

    @app.get("/api/credit-notes")
    def credit_notes(conn=Depends(db)):
        return jsonable_encoder(core.list_credit_notes(conn))

    @app.get("/api/credit-notes/{cn_id}/pdf")
    def credit_note_pdf(cn_id: int, download: bool = False, conn=Depends(db)):
        cn = next((c for c in core.list_credit_notes(conn) if c["id"] == cn_id), None)
        path = core.credit_note_path(conn, cn) if cn else None
        if not path or not path.exists():
            bad("Credit note PDF not found.", 404)
        return FileResponse(path, media_type="application/pdf", filename=path.name,
                            content_disposition_type="attachment" if download else "inline")

    @app.post("/api/invoices/{invoice_id}/refunds")
    def add_refund(invoice_id: int, body: PaymentIn, conn=Depends(db)):
        inv = invoice_or_404(conn, invoice_id)
        owed = core.payment_status(conn, inv)["refund_owed"]
        amount = core.dec(body.amount)
        if not amount or amount <= 0 or amount > owed:
            bad(f"Enter a refund up to the {money(owed)} owed.")
        core.add_payment(conn, invoice_id, body.paid_on, -amount, "Refund", body.note)
        return {"message": f"Refund of {money(amount)} recorded."}

    @app.delete("/api/payments/{payment_id}")
    def delete_payment(payment_id: int, conn=Depends(db)):
        core.delete_payment(conn, payment_id)
        return {"ok": True}

    @app.get("/api/invoices/defaults")
    def invoice_defaults(conn=Depends(db)):
        b = core.get_business(conn)
        return {"next_invoice_no": core.next_invoice_no(conn), "salesperson": core.last_salesperson(conn),
                "seller": core.seller_details(b), "seller_problems": core.seller_problems(b),
                "margin_scheme_text": core.MARGIN_SCHEME_TEXT}

    @app.post("/api/invoices/totals")
    def invoice_totals(body: dict):
        items = [{"cost": float(core.dec(it.get("cost")) or 0), "qty": int(core.dec(it.get("qty")) or 1)}
                 for it in body.get("items") or [] if it.get("desc") or it.get("cost") not in (None, "")]
        pricing = {k: float(core.dec((body.get("pricing") or {}).get(k)) or 0) for k in core.INVOICE_PRICING}
        out = core.invoice_totals(items, pricing)
        out["vat_line"] = core.standard_vat_line(pricing) if body.get("standard") else None
        return out

    def editing(conn, body: dict) -> dict | None:
        return invoice_or_404(conn, int(body["invoice_id"])) if body.get("invoice_id") else None

    @app.post("/api/invoices/check")
    def invoice_check(body: dict, conn=Depends(db)):
        return core.invoice_check(conn, body, editing(conn, body))

    @app.post("/api/invoices/draft.png")
    def invoice_draft(body: dict, conn=Depends(db)):
        try:
            png = core.draft_png(conn, body, editing(conn, body))
        except ValueError as e:
            bad(str(e))
        return Response(png, media_type="image/png", headers={"Cache-Control": "no-store"})

    @app.post("/api/invoices/draft.pdf")
    def invoice_draft_pdf(body: dict, conn=Depends(db)):
        try:
            pdf = core.draft_pdf(conn, body, editing(conn, body))
        except ValueError as e:
            bad(str(e))
        return Response(pdf, media_type="application/pdf",
                        headers={"Cache-Control": "no-store", "Content-Disposition": 'inline; filename="draft.pdf"'})

    @app.get("/api/invoices/{invoice_id}")
    def get_invoice(invoice_id: int, conn=Depends(db)):
        return invoice_out(conn, invoice_or_404(conn, invoice_id))

    @app.post("/api/invoices")
    def create_invoice(body: dict, conn=Depends(db)):
        inv = invoice_call(conn, core.create_invoice, body)
        return {**inv, "message": f"Invoice {inv['invoice_no']} created and {inv['reg']} marked sold."}

    @app.put("/api/invoices/{invoice_id}")
    def update_invoice(invoice_id: int, body: dict, conn=Depends(db)):
        inv = invoice_call(conn, core.update_invoice, invoice_id, body)
        return {**inv, "message": f"Invoice {inv['invoice_no']} saved and its PDF re-generated."}

    @app.post("/api/invoices/{invoice_id}/regenerate")
    def regenerate_invoice(invoice_id: int, conn=Depends(db)):
        inv = invoice_call(conn, core.regenerate_invoice_pdf, invoice_id)
        return {**inv, "message": f"Invoice {inv['invoice_no']} PDF re-generated."}

    @app.post("/api/invoices/{invoice_id}/void")
    def void_invoice(invoice_id: int, conn=Depends(db)):
        inv = invoice_call(conn, core.void_invoice, invoice_id)
        return {**inv, "message": f"Invoice {inv['invoice_no']} voided; {inv['reg']} is back in stock."}

    @app.get("/api/invoices/{invoice_id}/pdf")
    def invoice_pdf_file(invoice_id: int, download: bool = False, conn=Depends(db)):
        inv = invoice_or_404(conn, invoice_id)
        path = core.invoice_path(conn, inv)
        if not path or not path.exists():
            bad("Invoice PDF not found. Use Re-generate PDF.", 404)
        return FileResponse(path, media_type="application/pdf", filename=path.name,
                            content_disposition_type="attachment" if download else "inline")

    @app.get("/api/invoices/{invoice_id}/preview.png")
    def invoice_preview(invoice_id: int, conn=Depends(db)):
        try:
            png = core.invoice_png(conn, invoice_id)
        except ValueError as e:
            bad(str(e), 404)
        return Response(png, media_type="image/png", headers={"Cache-Control": "no-store"})

    # ---------------------------------------------------------------- rules

    @app.get("/api/rules")
    def rules(conn=Depends(db)):
        return [{"keyword": k, "category": c} for k, c in core.get_rules(conn)]

    @app.put("/api/rules")
    def save_rules(body: list[Rule], conn=Depends(db)):
        n = core.save_rules(conn, [(r.keyword, r.category) for r in body])
        return {"message": f"Saved {plural(n, 'rule')}."}

    @app.post("/api/rules")
    def quick_rule(body: Rule, conn=Depends(db)):
        if not body.keyword.strip():
            bad("Enter a keyword.")
        core.add_rules(conn, [(body.keyword.strip(), body.category)])
        n = core.auto_categorise(conn)
        return {"message": f"Rule added; categorised {plural(n, 'transaction')}."}

    @app.post("/api/rules/starter")
    def starter_rules(conn=Depends(db)):
        n = core.add_rules(conn, core.STARTER_RULES)
        m = core.auto_categorise(conn)
        return {"message": f"Added {plural(n, 'rule')}; categorised {plural(m, 'transaction')}."}

    # ---------------------------------------------------------------- front end

    if DIST.exists():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                bad("Not found.", 404)
            file = (DIST / path).resolve()
            inside = file.is_relative_to(DIST.resolve())  # never serve files outside the build
            return FileResponse(file if path and inside and file.is_file() else DIST / "index.html")

    return app


def build_app(db_path: str | None = None) -> FastAPI:
    """The admin site as the website serves it: everything under /admin (pages at /admin/...,
    the API at /admin/api/...). Run with: uvicorn server:build_app --factory"""
    root = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    root.mount("/admin", create_app(db_path, admin_auth.Auth()))

    @root.get("/", include_in_schema=False)
    def to_admin():
        return RedirectResponse("/admin/")

    # "/admin" itself is the home page too (no redirect, so a proxy that strips the trailing
    # slash can't loop).
    @root.get("/admin", include_in_schema=False)
    def admin_home():
        if not (DIST / "index.html").exists():
            bad("The web page isn't built: run npm run build in apps/admin/web.", 404)
        return FileResponse(DIST / "index.html")

    return root


if __name__ == "__main__":
    import os
    import webbrowser

    import uvicorn
    port = int(os.environ.get("PORT", 8501))
    threading.Timer(1.5, webbrowser.open, [f"http://127.0.0.1:{port}/admin/"]).start()
    uvicorn.run(build_app(), host="127.0.0.1", port=port)
