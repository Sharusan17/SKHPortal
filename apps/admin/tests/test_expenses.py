"""Expenses: kinds of cost with their VAT, cash and personal-card expenses, and the period summary."""
from datetime import date
from decimal import Decimal

from core import ZERO

import pytest
from fastapi.testclient import TestClient

import core
import server
from test_core import Q3, import_bank, seed_cars
from test_invoices import BUSINESS


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "v.db")
    core.save_business(c, BUSINESS)
    seed_cars(c)
    import_bank(c)
    yield c
    c.close()


def line(conn, desc):
    return conn.execute("SELECT * FROM transactions WHERE description = ?", (desc,)).fetchone()


def test_summary_from_bank_lines(conn):
    e = core.expenses(conn, Q3)
    descs = {x["description"]: x for x in e["lines"]}
    assert set(descs) == {"Shell fuel", "AutoTrader advert", "Motor trade insurance"}  # HMRC VAT excluded
    assert descs["Shell fuel"]["expense_type"] == "Fuel" and not descs["Shell fuel"]["type_set"]
    assert e["totals"]["gross"] == Decimal("600.00") and e["totals"]["vat"] == Decimal("60.00")
    assert e["totals"]["missing_receipts"] == 2 and e["totals"]["general"] == Decimal("600.00")


def test_type_sets_vat_and_vat_return_follows(conn):
    before = core.calculate_return(conn, Q3).box_str(4)
    ins = line(conn, "Motor trade insurance")["id"]
    core.set_expense_type(conn, ins, "Valeting")  # a cost with VAT: 240 / 6 = 40 reclaimed
    t = line(conn, "Motor trade insurance")
    assert (t["category"], t["vat"], t["expense_type"]) == (core.EXPENSE_VAT, "40.00", "Valeting")
    assert core.calculate_return(conn, Q3).box_str(4) == f"{Decimal(before) + 40:.2f}"
    core.set_expense_type(conn, ins, "Insurance")
    assert core.calculate_return(conn, Q3).box_str(4) == before
    with pytest.raises(ValueError, match="Unknown"):
        core.set_expense_type(conn, ins, "Holidays")


def test_cash_expense_counts_once(conn):
    before = core.calculate_return(conn, Q3)
    car = conn.execute("SELECT id FROM cars WHERE reg = 'AB12 CDE'").fetchone()["id"]
    txn = core.add_expense(conn, date(2026, 7, 25), "Brake pads", 120, "Parts", "Cash", car_id=car)
    after = core.calculate_return(conn, Q3)
    assert after.boxes[4] - before.boxes[4] == Decimal("20.00")
    assert after.boxes[7] - before.boxes[7] == Decimal("100")
    assert next(c for c in core.car_overview(conn) if c["id"] == car)["costs_net"] == Decimal("100.00")
    e = core.expenses(conn, Q3)
    x = next(x for x in e["lines"] if x["id"] == txn)
    assert (x["paid_by"], x["car_reg"], x["expense_type"]) == ("Cash", "AB12 CDE", "Parts")
    assert e["totals"]["cars"] == Decimal("120.00")
    with pytest.raises(ValueError, match="Tide import"):
        core.add_expense(conn, date(2026, 7, 25), "x", 1, "Parts", "Bank")
    with pytest.raises(ValueError, match="added by hand"):
        core.delete_expense(conn, line(conn, "Shell fuel")["id"])
    core.delete_expense(conn, txn)
    assert core.calculate_return(conn, Q3).box_str(4) == before.box_str(4)


def test_changing_category_away_from_expense_clears_type(conn):
    fuel = line(conn, "Shell fuel")["id"]
    core.set_expense_type(conn, fuel, "Fuel")
    import pandas as pd
    core.update_transactions(conn, pd.DataFrame([{"id": fuel, "category": core.EXCLUDE, "vat": None, "notes": ""}]))
    assert line(conn, "Shell fuel")["expense_type"] is None


def test_endpoints(tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "v.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782"}).raise_for_status()
    assert any(t["name"] == "MOT" and not t["vat"] for t in client.get("/api/meta").json()["expense_types"])
    r = client.post("/api/expenses", json={"date": "2026-10-03", "description": "Valet", "amount": 60,
                                          "expense_type": "Valeting", "paid_by": "Personal card"})
    txn = r.json()["id"]
    assert client.post("/api/expenses", json={"date": "2026-10-03", "description": "", "amount": 60,
                                              "expense_type": "Valeting"}).status_code == 400
    e = client.get("/api/expenses", params={"p": "all"}).json()
    assert e["lines"][0]["paid_by"] == "Personal card" and e["totals"]["vat"] == 10.0
    assert client.patch(f"/api/expenses/{txn}", json={"expense_type": "Other (no VAT)"}).status_code == 200
    assert client.get("/api/expenses", params={"p": "all"}).json()["totals"]["vat"] == 0
    assert client.delete(f"/api/expenses/{txn}").status_code == 200


def test_edit_cash_expense(conn):
    txn = core.add_expense(conn, date(2026, 7, 25), "Brake pads", 120, "Parts", "Cash")
    x = core.get_expense(conn, txn)
    assert x["manual"] and x["vat"] == Decimal("20.00") and x["default_vat"] == Decimal("20.00")
    core.update_expense(conn, txn, {"date": "2026-08-01", "description": "Brake discs", "amount": 180,
                                    "paid_by": "Personal card", "notes": "eBay"})
    x = core.get_expense(conn, txn)
    assert (x["date"], x["description"], x["gross"], x["vat"], x["paid_by"], x["notes"]) == (
        date(2026, 8, 1), "Brake discs", Decimal("180.00"), Decimal("30.00"), "Personal card", "eBay")
    core.update_expense(conn, txn, {"vat": 12})
    assert core.get_expense(conn, txn)["vat"] == Decimal("12.00")
    core.update_expense(conn, txn, {"amount": 60})  # VAT typed by hand sticks
    assert core.get_expense(conn, txn)["vat"] == Decimal("12.00")
    core.update_expense(conn, txn, {"vat": None, "expense_type": "MOT"})
    assert core.get_expense(conn, txn)["vat"] == ZERO
    with pytest.raises(ValueError, match="more than"):
        core.update_expense(conn, txn, {"expense_type": "Parts", "vat": 100})
    with pytest.raises(ValueError, match="amount"):
        core.update_expense(conn, txn, {"amount": 0})


def test_edit_bank_line_keeps_tide_fields(conn):
    fuel = line(conn, "Shell fuel")["id"]
    x = core.get_expense(conn, fuel)
    core.update_expense(conn, fuel, {"date": x["date"].isoformat(), "description": x["description"],
                                     "amount": x["gross"], "expense_type": "Fuel", "notes": "van"})
    assert core.get_expense(conn, fuel)["notes"] == "van"
    with pytest.raises(ValueError, match="come from Tide"):
        core.update_expense(conn, fuel, {"amount": 99})
    core.update_expense(conn, fuel, {"amount": 72, "description": "Shell diesel", "unlocked": True})
    x = core.get_expense(conn, fuel)
    assert (x["gross"], x["description"], x["paid_by"], x["manual"]) == (Decimal("72.00"), "Shell diesel", "Bank", False)
    with pytest.raises(ValueError, match="not found"):
        core.get_expense(conn, 99999)


def test_edit_endpoint(tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "v.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782"}).raise_for_status()
    txn = client.post("/api/expenses", json={"date": "2026-10-03", "description": "Valet", "amount": 60,
                                             "expense_type": "Valeting"}).json()["id"]
    r = client.patch(f"/api/expenses/{txn}", json={"description": "Full valet", "amount": 90, "vat": None})
    assert r.status_code == 200
    x = client.get(f"/api/expenses/{txn}").json()
    assert (x["description"], x["gross"], x["vat"]) == ("Full valet", 90.0, 15.0)
    assert client.get("/api/expenses/9999").status_code == 404


def test_refunds(conn):
    before = core.calculate_return(conn, Q3)
    paid = core.add_expense(conn, date(2026, 7, 20), "Alternator", 240, "Parts", "Cash")
    back = core.add_expense(conn, date(2026, 7, 28), "Alternator returned", 240, "Parts", "Cash", refund=True)
    after = core.calculate_return(conn, Q3)
    assert after.boxes[4] == before.boxes[4] and after.boxes[7] == before.boxes[7]  # cancels out
    e = core.expenses(conn, Q3)
    r = next(x for x in e["lines"] if x["id"] == back)
    assert r["refund"] and r["gross"] == Decimal("-240.00") and r["vat"] == Decimal("-40.00") and not r["needs_receipt"]
    assert e["totals"]["refunds"] == Decimal("240.00") and e["totals"]["gross"] == Decimal("600.00")
    # A Tide refund (money in, categorised as a cost) also shows, and the expense page can edit it.
    t = core.add_transaction(conn, date(2026, 7, 29), "SHELL REFUND", 30, core.EXPENSE_VAT)
    x = core.get_expense(conn, t)
    assert x["refund"] and x["vat"] == Decimal("-5.00")
    core.update_expense(conn, t, {"vat": 4})
    assert core.get_expense(conn, t)["vat"] == Decimal("-4.00")
    core.update_expense(conn, paid, {"amount": 120})
    assert core.get_expense(conn, paid)["gross"] == Decimal("120.00")
