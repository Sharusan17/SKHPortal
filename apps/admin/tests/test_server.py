"""API tests against a temp database, through FastAPI's TestClient (no live lookups)."""
import io
import json

import pytest
from PIL import Image
from fastapi.testclient import TestClient

import core
import lookups
import server
from test_core import Q3, TIDE_CSV, import_bank, seed_cars

BUSINESS = {"company_name": "Test Motors Ltd", "vrn": "GB 123 4567 82", "stagger": "MAR",
            "vat_reg_date": "2020-01-01"}


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "vat.db"


@pytest.fixture
def client(db_path):
    return TestClient(server.create_app(str(db_path)))


@pytest.fixture
def seeded(db_path, client):
    client.put("/api/business", json=BUSINESS).raise_for_status()
    conn = core.connect(db_path)
    seed_cars(conn)
    import_bank(conn)
    conn.close()
    return client


def test_business_onboarding(client):
    assert client.get("/api/business").json() is None
    assert client.get("/api/quarters").status_code == 409
    r = client.put("/api/business", json={**BUSINESS, "vrn": "123456789"})
    assert r.status_code == 400 and "check-digit" in r.json()["detail"]
    r = client.put("/api/business", json=BUSINESS)
    assert r.json()["vrn"] == "123456782" and r.json()["vrn_formatted"] == "GB 123 4567 82"


def test_hmrc_confirmation_allows_failing_check_digits(client, monkeypatch):
    monkeypatch.setattr(lookups, "hmrc_check_vat_number",
                        lambda vrn: {"vrn": "553557881", "name": "Credite Sberger Donal Inc.", "address": ""})
    assert client.put("/api/business", json={**BUSINESS, "vrn": "553557881"}).status_code == 400
    r = client.post("/api/lookup/hmrc", json={"vrn": "553557881", "company_name": "Test Motors Ltd"})
    assert r.json()["name_matches"] is False
    assert client.get("/api/vrn-check", params={"vrn": "553557881"}).json()["hmrc_confirmed"]
    assert client.put("/api/business", json={**BUSINESS, "vrn": "553557881"}).status_code == 200


def test_q3_return(seeded):
    quarters = seeded.get("/api/quarters").json()
    assert Q3.start.isoformat() in [q["id"] for q in quarters]
    r = seeded.get("/api/return", params={"q": Q3.start.isoformat()}).json()
    assert list(r["boxes"].values()) == ["2670.00", "0.00", "2670.00", "2060.00", "610.00",
                                         "21150", "22540", "0", "0"]
    assert r["net"] == 610.0 and len(r["cars_sold"]) == 3
    assert any("no receipt" in w for w in r["warnings"])
    assert r["progress"]["total"] == 6


def test_filing_and_exports(seeded):
    q = {"q": Q3.start.isoformat()}
    assert seeded.post("/api/filing", params=q, json={"filed_on": "2026-10-20"}).status_code == 200
    assert seeded.get("/api/return", params=q).json()["filed_on"] == "2026-10-20"
    assert [x for x in seeded.get("/api/quarters").json() if x["id"] == q["q"]][0]["status"] == "filed"
    assert seeded.delete("/api/filing", params=q).status_code == 200
    assert b"2670.00" in seeded.get("/api/export/boxes.csv", params=q).content
    assert seeded.get("/api/export/quarter.csv", params=q).status_code == 200
    assert seeded.get("/api/export/receipts.zip", params=q).status_code == 404
    assert seeded.get("/api/backup.zip").headers["content-type"] == "application/zip"


def test_add_car_and_sale_with_part_exchange(seeded):
    r = seeded.post("/api/cars", json={"reg": "zz11 zzz", "scheme": "Standard",
                                       "purchase_date": "2026-10-01", "purchase_price": 6000})
    assert r.status_code == 400 and "purchase VAT" in r.json()["detail"]
    seeded.post("/api/cars", json={"reg": "zz11 zzz", "make_model": "Kia", "scheme": "Margin",
                                   "purchase_date": "2026-10-01", "purchase_price": 6000}).raise_for_status()
    car = next(c for c in seeded.get("/api/cars").json() if c["reg"] == "ZZ11 ZZZ")

    p = seeded.post("/api/sale-preview", json={"car_id": car["id"], "sale_price": 9000}).json()
    assert (p["vat"], p["margin"]) == (500.0, 3000.0)
    sale = {"sale_date": "2026-10-10", "sale_price": 9000, "px_allowance": 2000, "px_reg": ""}
    assert seeded.post(f"/api/cars/{car['id']}/sale", json=sale).status_code == 400
    r = seeded.post(f"/api/cars/{car['id']}/sale", json={**sale, "px_reg": "px11 aaa"})
    assert "PX11 AAA added to stock" in r.json()["message"]
    px = next(c for c in seeded.get("/api/cars").json() if c["reg"] == "PX11 AAA")
    assert px["purchase_price"] == 2000.0 and px["px_for"] == car["id"]


def test_save_stock_book_grid(seeded):
    cars = seeded.get("/api/cars").json()
    rows = [{**c, "make_model": "Edited"} if c["reg"] == "EF56 GHI" else c for c in cars]
    rows = [c for c in rows if c["reg"] != "CD34 EFG"]
    r = seeded.put("/api/cars", json={"rows": rows, "shown_ids": [c["id"] for c in cars]})
    assert r.status_code == 200
    after = {c["reg"]: c for c in seeded.get("/api/cars").json()}
    assert after["EF56 GHI"]["make_model"] == "Edited" and "CD34 EFG" not in after


def test_transactions_edit_and_rules(seeded):
    q = {"q": Q3.start.isoformat()}
    txns = seeded.get("/api/transactions", params=q).json()
    fuel = next(t for t in txns if t["description"] == "Shell fuel")
    assert fuel["vat"] == 10.0
    seeded.patch("/api/transactions", json=[{"id": fuel["id"], "category": core.EXPENSE_NO_VAT,
                                             "vat": None, "notes": "x"}]).raise_for_status()
    fuel = next(t for t in seeded.get("/api/transactions", params=q).json() if t["id"] == fuel["id"])
    assert (fuel["category"], fuel["vat"], fuel["notes"]) == (core.EXPENSE_NO_VAT, 0.0, "x")

    assert seeded.post("/api/rules", json={"keyword": " ", "category": core.EXCLUDE}).status_code == 400
    seeded.post("/api/rules/starter").raise_for_status()
    assert any(r["keyword"] == "dvla" for r in seeded.get("/api/rules").json())
    seeded.put("/api/rules", json=[{"keyword": "fuel", "category": core.EXPENSE_VAT}]).raise_for_status()
    assert len(seeded.get("/api/rules").json()) == 1
    assert "count" in seeded.post("/api/transactions/auto-categorise").json()


def test_csv_import_and_receipts(seeded):
    csv = TIDE_CSV.to_csv(index=False).encode() + b"Total,,,,,5.00,\n"
    prev = seeded.post("/api/import/preview", files={"file": ("tide.csv", csv)}).json()
    assert prev["guess"]["date"] == "Date" and prev["rows"] == 7
    r = seeded.post("/api/import", files={"file": ("tide.csv", csv)},
                    data={"mapping": json.dumps(prev["guess"])}).json()
    assert "skipped 6 already imported" in r["message"] and len(r["failed"]) == 1

    q = {"q": Q3.start.isoformat()}
    txn = seeded.get("/api/transactions", params=q).json()[0]
    bad = seeded.post(f"/api/transactions/{txn['id']}/receipts", files=[("files", ("x.exe", b"1"))])
    assert bad.status_code == 400
    seeded.post(f"/api/transactions/{txn['id']}/receipts",
                files=[("files", ("r.pdf", b"%PDF-1.4"))]).raise_for_status()
    rc = seeded.get(f"/api/transactions/{txn['id']}/receipts").json()[0]
    assert seeded.get(f"/api/receipts/{rc['id']}/file").content == b"%PDF-1.4"
    seeded.delete(f"/api/receipts/{rc['id']}").raise_for_status()
    assert seeded.get(f"/api/transactions/{txn['id']}/receipts").json() == []


def test_invoice_endpoints(client, tmp_path, monkeypatch):
    monkeypatch.setattr(server.invoice_pdf, "DEFAULT_LOGO", tmp_path / "assets" / "logo.png")
    biz = {**BUSINESS, "registered_office": "1 High Street\nMK16 0AY", "sort_code": "20-19-97",
           "account_no": "40839531", "invoice_start": 24, "stock_start": 10}
    client.put("/api/business", json=biz).raise_for_status()
    client.post("/api/cars", json={"reg": "mf69 vpp", "make_model": "BMW X5", "scheme": "Margin",
                                   "purchase_date": "2026-10-01", "purchase_price": 25000,
                                   "colour": "Black", "mileage": "53000"}).raise_for_status()
    car = client.get("/api/cars").json()[0]
    assert car["stock_no"] == "0010" and car["colour"] == "Black"

    d = client.get("/api/invoices/defaults").json()
    assert d["next_invoice_no"] == "0024" and d["seller_problems"] == [] and d["seller"]["vat_no"] == "123 4567 82"
    t = client.post("/api/invoices/totals", json={"items": [{"desc": "Vehicle", "qty": 1, "cost": 29500}],
                                                  "pricing": {"selling_price": 29500, "px_allowance": 5000}})
    assert t.json()["balance"] == 24500

    body = {"vehicle_id": car["id"], "invoice_date": "2026-10-09", "salesperson": "San",
            "buyer": {"name": "City Cars", "address": ["Murtle Den Road", "Aberdeen"]},
            "items": [{"desc": "Vehicle (MF69 VPP)", "qty": 1, "cost": 29500}],
            "pricing": {"selling_price": 29500}, "margin_scheme": True,
            "vehicle": {"make": "BMW", "model": "X5", "colour": "Black", "mileage": "53000"}}
    chk = client.post("/api/invoices/check", json={**body, "salesperson": "W" * 30, "buyer": {"name": ""}}).json()
    assert "Enter the buyer's name." in chk["problems"] and "salesperson" in chk["fields"]
    assert client.post("/api/invoices/check", json=body).json() == {"problems": [], "fields": {}}
    draft = client.post("/api/invoices/draft.png", json={**body, "buyer": {"name": ""}})
    assert draft.content[:4] == b"\x89PNG"  # previews even while details are missing
    assert client.post("/api/invoices/draft.png", json={"vehicle_id": 0}).status_code == 400
    assert client.get("/api/invoices/defaults").json()["next_invoice_no"] == "0024"  # no number used
    assert client.post("/api/invoices", json={**body, "buyer": {"name": ""}}).status_code == 400
    inv = client.post("/api/invoices", json=body).json()
    assert inv["invoice_no"] == "0024" and inv["pdf_exists"] and "marked sold" in inv["message"]
    assert client.get("/api/cars").json()[0]["sales_invoice_no"] == "0024"
    assert client.get(f"/api/invoices/{inv['id']}/pdf").content[:4] == b"%PDF"
    assert client.get(f"/api/invoices/{inv['id']}/preview.png").content[:4] == b"\x89PNG"
    assert client.get("/api/invoices/defaults").json()["salesperson"] == "San"

    r = client.put(f"/api/invoices/{inv['id']}", json={**body, "pricing": {"selling_price": 30000}})
    assert r.json()["totals"]["total_price"] == 30000
    assert client.post(f"/api/invoices/{inv['id']}/regenerate").status_code == 200
    assert client.put("/api/business", json={**biz, "invoice_start": 1}).status_code == 400
    v = client.post(f"/api/invoices/{inv['id']}/void").json()
    assert v["void"] and client.get("/api/cars").json()[0]["sale_date"] is None
    assert [i["invoice_no"] for i in client.get("/api/invoices").json()] == ["0024"]

    png = io.BytesIO()
    Image.new("RGB", (30, 16), "navy").save(png, format="PNG")
    assert client.post("/api/logo", files={"file": ("logo.png", png.getvalue())}).status_code == 200
    assert client.post("/api/logo", files={"file": ("x.png", b"not an image")}).status_code == 400
    assert client.get("/api/business").json()["has_logo"]


def test_reconciliation(seeded):
    rec = seeded.get("/api/reconciliation", params={"q": Q3.start.isoformat()}).json()
    assert {"unlinked_txns", "sold_unpaid", "bought_unpaid"} <= rec.keys()
