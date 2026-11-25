"""What a user's held change would do, as readable before/after fields for the Approvals page.

describe() is called when the change is queued, so "before" is the record as it was when the user
saved, and still makes sense after the change is approved."""
import re

import core

_MONEY = re.compile(r"price|fee|vat|amount|cost|allowance|charge|settlement|deposit|finance|delivery|"
                    r"accessories|licence|cherished|warranty_ipt|^warranty$|gross")
_SKIP = {"unlocked", "invoice_id"}

_LABELS = {
    "reg": "Reg", "make_model": "Make and model", "purchase_vat": "Purchase VAT", "buyer_fee": "Buyer's fee",
    "buyer_fee_vat": "Buyer's fee VAT", "assured_charge_vat": "Assured charge VAT", "lot_no": "Lot no.",
    "car_id": "Car", "vat": "VAT", "paid_by": "Paid by", "expense_type": "Type", "amount": "Amount",
    "rf_licence": "Road fund licence", "warranty_ipt": "Warranty IPT", "px_allowance": "Part exchange allowance",
    "hp_settlement": "HP settlement", "first_reg": "First registered", "mfr_date": "Manufactured",
    "engine_no": "Engine no.", "chassis_no": "Chassis no.", "order_no": "Order no.",
    "warranty_no": "Warranty no.", "filename": "File name",
}


def _label(key: str) -> str:
    return _LABELS.get(key) or key.replace("_", " ").capitalize()


def _money(v) -> str:
    d = core.dec(v)
    return "" if d is None else f"£{d:,.2f}"


def _show(key: str, v, regs: dict) -> str:
    """One value as the page shows it."""
    if v is None or v == "" or v == []:
        return ""
    if key == "car_id" or key == "vehicle_id":
        try:
            return regs.get(int(v)) or str(v)
        except (TypeError, ValueError):
            return str(v)
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, list):
        return ", ".join(_show(key, x, regs) for x in v if x not in (None, ""))
    if isinstance(v, dict):
        return ", ".join(f"{_label(k)}: {_show(k, x, regs)}" for k, x in v.items() if x not in (None, "", []))
    if _MONEY.search(key):
        try:
            return _money(v)
        except Exception:
            return str(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(v)):
        return core._uk(v)
    return str(v)


def _row(key, label, before, after) -> dict:
    return {"key": key, "label": label, "before": before, "after": after, "changed": before != after}


def _regs(conn) -> dict:
    return {r["id"]: r["reg"] for r in conn.execute("SELECT id, reg FROM cars")}


def _invoice_fields(inv: dict, regs: dict) -> list[tuple[str, str, str]]:
    """(key, label, value) for an invoice, in the order of the form."""
    out = [("vehicle_id", "Car", _show("car_id", inv.get("vehicle_id"), regs)),
           ("invoice_date", "Invoice date", core._uk(inv.get("invoice_date"))),
           ("salesperson", "Salesperson", inv.get("salesperson") or ""),
           ("buyer_name", "Buyer", inv.get("buyer_name") or ""),
           ("buyer_address", "Buyer address", ", ".join(inv.get("buyer_address") or [])),
           ("buyer_email", "Buyer email", inv.get("buyer_email") or ""),
           ("buyer_phone", "Buyer phone", inv.get("buyer_phone") or "")]
    if inv.get("deliver_same"):
        deliver = "Same as buyer"
    else:
        deliver = ", ".join(x for x in [inv.get("deliver_name") or "", *(inv.get("deliver_address") or []),
                                        inv.get("deliver_email") or "", inv.get("deliver_phone") or ""] if x)
    out.append(("deliver_to", "Deliver to", deliver))
    vehicle = inv.get("vehicle") or {}
    for k in core.INVOICE_VEHICLE:
        out.append((f"vehicle.{k}", _label(k), _show(k, vehicle.get(k), regs)))
    pricing = inv.get("pricing") or {}
    for k in core.INVOICE_PRICING:
        v = pricing.get(k)
        out.append((f"pricing.{k}", _label(k), _money(v) if v else ""))
    items = "; ".join(f"{it.get('desc')}{' x' + str(it.get('qty')) if (it.get('qty') or 1) != 1 else ''} "
                      f"{_money(it.get('cost'))}" for it in inv.get("items") or [])
    out += [("items", "Items", items),
            ("warranty_lines", "Warranty", "; ".join(inv.get("warranty_lines") or [])),
            ("special_instructions", "Special instructions", "; ".join(inv.get("special_instructions") or [])),
            ("margin_scheme", "Margin scheme", "Yes" if inv.get("margin_scheme") else "No")]
    totals = inv.get("totals") or {}
    for k in ("total", "balance_due", "balance"):
        if k in totals:
            out.append((f"totals.{k}", _label(k), _money(totals[k])))
            break
    return out


def _invoice_from(conn, data: dict, current: dict | None) -> dict | None:
    row, _ = core._invoice_input(conn, data, current)
    return core._parse_invoice({**(current or {}), **row}) if row else None


def describe(conn, method: str, path: str, data) -> dict | None:
    """{kind: "edit"|"new", fields: [{key, label, before, after, changed}], invoice_id} or None."""
    if not isinstance(data, dict):
        return None
    regs = _regs(conn)
    m = re.fullmatch(r"/api/invoices/(\d+)", path)
    if (method == "PUT" and m) or (method == "POST" and path == "/api/invoices"):
        old = core.get_invoice(conn, int(m.group(1))) if m else None
        new = _invoice_from(conn, data, old)
        if new is None:
            return None
        after = _invoice_fields(new, regs)
        if old is None:
            return {"kind": "new", "invoice_id": None,
                    "fields": [_row(k, lab, "", v) for k, lab, v in after if v]}
        before = {k: v for k, _, v in _invoice_fields(old, regs)}
        return {"kind": "edit", "invoice_id": old["id"],
                "fields": [_row(k, lab, before.get(k, ""), v) for k, lab, v in after]}

    current = None
    m = re.fullmatch(r"/api/(cars|expenses|documents)/(\d+)", path)
    if method == "PATCH" and m:
        kind, rid = m.group(1), int(m.group(2))
        if kind == "cars":
            current = core._car(conn, rid)
        elif kind == "expenses":
            try:
                x = core.get_expense(conn, rid)
                current = {**x, "amount": x["gross"], "vat": x["vat_entered"]}
            except ValueError:
                current = None
        else:
            r = conn.execute("SELECT * FROM car_documents WHERE id = ?", (rid,)).fetchone()
            current = dict(r) if r else None
        if current is None:
            return None
    elif method != "POST":
        return None

    fields = []
    for k, v in data.items():
        if k in _SKIP:
            continue
        after = _show(k, v, regs)
        before = _show(k, current.get(k), regs) if current is not None else ""
        if current is None and not after:
            continue
        fields.append(_row(k, _label(k), before, after))
    return {"kind": "edit" if current is not None else "new", "invoice_id": None, "fields": fields}
