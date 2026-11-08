"""Credit notes: a returned car or a later price reduction, with the VAT reversed in the credit
note's own quarter so a filed return never changes."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import core
import server
from test_invoices import BUSINESS, invoice

Q3 = core.Quarter(date(2026, 7, 1), date(2026, 9, 30))
Q4 = core.Quarter(date(2026, 10, 1), date(2026, 12, 31))


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "v.db")
    core.save_business(c, BUSINESS)
    yield c
    c.close()


def sold(conn, scheme=core.MARGIN, price=5000, pvat=None, sale=6200, on="2026-09-10"):
    car = core.add_car(conn, "AB12 CDE", "VW Golf", scheme, date(2026, 8, 1), price, pvat)
    inv = core.create_invoice(conn, invoice(car, sale, on, margin_scheme=scheme == core.MARGIN))
    return car, inv


def test_return_after_filing_reverses_in_the_current_quarter(conn):
    car, inv = sold(conn)
    core.mark_filed(conn, Q3, date(2026, 10, 20))
    filed = core.calculate_return(conn, Q3)
    assert filed.box_str(1) == "200.00" and filed.box_str(6) == "6000"  # margin 1200 / 6
    with pytest.raises(ValueError, match="filed with HMRC"):
        core.void_invoice(conn, inv["id"])

    cn = core.create_credit_note(conn, inv["id"], "return", date(2026, 10, 25), reason="Gearbox fault")
    assert cn["credit_no"] == "CN-0001" and cn["amount"] == Decimal("6200.00") and cn["vat"] == Decimal("200.00")
    # Q3 is untouched (no "figures changed since filing" warning); Q4 takes the reversal.
    after = core.calculate_return(conn, Q3)
    assert after.box_str(1) == "200.00" and after.box_str(6) == "6000"
    assert not any("changed" in w for w in after.warnings)
    q4 = core.calculate_return(conn, Q4)
    assert q4.box_str(1) == "-200.00" and q4.box_str(6) == "-6000"
    # The car is back in stock and can be sold again.
    c = next(x for x in core.car_overview(conn, date(2026, 11, 8)) if x["id"] == car)
    assert c["sale_date"] is None and c["stage"] == "for_sale" and c["invoice"] is None
    again = core.create_invoice(conn, invoice(car, 5900, "2026-11-01"))
    assert core.calculate_return(conn, Q4).box_str(1) == "-50.00"  # -200 + 900 / 6
    assert again["invoice_no"] == "0002"
    path = core.credit_note_path(conn, cn)
    assert path.exists() and path.name == "CN-0001_AB12CDE.pdf"
    with pytest.raises(ValueError, match="already been credited"):
        core.create_credit_note(conn, inv["id"], "return", date(2026, 10, 26))


def test_return_and_sale_in_same_quarter_cancel(conn):
    _, inv = sold(conn)
    core.create_credit_note(conn, inv["id"], "return", date(2026, 9, 20))
    r = core.calculate_return(conn, Q3)
    assert r.box_str(1) == "0.00" and r.box_str(6) == "0"


def test_discount_on_margin_car(conn):
    car, inv = sold(conn)  # margin 1200, VAT 200
    cn = core.create_credit_note(conn, inv["id"], "discount", date(2026, 10, 2), 300, "Scratch")
    assert cn["vat"] == Decimal("50.00")  # new margin 900 -> VAT 150
    q4 = core.calculate_return(conn, Q4)
    assert q4.box_str(1) == "-50.00" and q4.box_str(6) == "-250"
    c = next(x for x in core.car_overview(conn, date(2026, 11, 8)) if x["id"] == car)
    assert c["vat_due"] == Decimal("150.00") and c["profit"] == Decimal("750.00")  # 5900 - 150 - 5000
    # A discount bigger than the margin: VAT only falls to zero (no negative margin VAT).
    cn2 = core.create_credit_note(conn, inv["id"], "discount", date(2026, 10, 3), 1500)
    assert cn2["vat"] == Decimal("150.00")
    with pytest.raises(ValueError, match="whole price"):
        core.create_credit_note(conn, inv["id"], "discount", date(2026, 10, 4), 4400)


def test_discount_on_vat_qualifying_car(conn):
    _, inv = sold(conn, core.STANDARD, 12000, 2000, 14400)
    cn = core.create_credit_note(conn, inv["id"], "discount", date(2026, 10, 2), 600)
    assert cn["vat"] == Decimal("100.00")
    assert core.calculate_return(conn, Q4).box_str(6) == "-500"


def test_payments_and_refunds(conn):
    car, inv = sold(conn)
    t = core.add_transaction(conn, date(2026, 9, 12), "FPS J BLOGGS", 6200)
    core.pay_invoice_from_bank(conn, t, inv["id"])
    core.create_credit_note(conn, inv["id"], "discount", date(2026, 9, 20), 200)
    st = core.payment_status(conn, core.get_invoice(conn, inv["id"]))
    assert (st["due"], st["status"], st["refund_owed"]) == (Decimal("6000.00"), "refund_owed", Decimal("200.00"))
    assert any("refund £200.00" in a["text"] for a in core.home_summary(conn, date(2026, 11, 8))["actions"])
    out = core.add_transaction(conn, date(2026, 9, 22), "REFUND J BLOGGS", -200)
    core.pay_invoice_from_bank(conn, out, inv["id"])
    st = core.payment_status(conn, core.get_invoice(conn, inv["id"]))
    assert st["status"] == "paid" and st["refund_owed"] == 0
    # The refund line is a car-sale line, so it isn't counted again in the VAT return.
    assert conn.execute("SELECT category FROM transactions WHERE id = ?", (out,)).fetchone()[0] == core.CAR_SALE
    with pytest.raises(ValueError, match="No refund is owed"):
        core.pay_invoice_from_bank(conn, core.add_transaction(conn, date(2026, 9, 23), "X", -5), inv["id"])
    with pytest.raises(ValueError, match="credit note"):
        core.update_invoice(conn, inv["id"], invoice(car, 6000, "2026-09-10"))


def test_validation(conn):
    _, inv = sold(conn)
    with pytest.raises(ValueError, match="before the invoice"):
        core.create_credit_note(conn, inv["id"], "return", date(2026, 9, 1))
    with pytest.raises(ValueError, match="Pick"):
        core.create_credit_note(conn, inv["id"], "refund", date(2026, 9, 20))
    with pytest.raises(ValueError, match="amount"):
        core.create_credit_note(conn, inv["id"], "discount", date(2026, 9, 20), 0)


def test_endpoints(tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "v.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782"}).raise_for_status()
    car = client.post("/api/cars", json={"reg": "AB12 CDE", "make_model": "VW Golf", "scheme": "Margin",
                                         "purchase_date": "2026-08-01", "purchase_price": 5000}).json()["id"]
    inv = client.post("/api/invoices", json=invoice(car, 6200, "2026-09-10")).json()
    r = client.post(f"/api/invoices/{inv['id']}/credit-notes", json={"kind": "discount", "credit_date": "2026-10-02",
                                                                      "amount": 300})
    assert r.status_code == 200 and r.json()["credit_no"] == "CN-0001"
    got = client.get("/api/invoices").json()[0]
    assert got["credit_notes"][0]["vat"] == 50.0 and got["payment"]["due"] == 5900.0
    assert client.get(f"/api/credit-notes/{r.json()['id']}/pdf").status_code == 200
    assert client.post(f"/api/invoices/{inv['id']}/refunds", json={"paid_on": "2026-10-03", "amount": 10}).status_code == 400


def test_credit_on_sale_before_registration_is_not_on_any_return(conn):
    core.save_business(conn, {**BUSINESS, "vat_reg_date": "2026-09-01"})
    _, inv = sold(conn, on="2026-08-20")  # sold before registration
    cn = core.create_credit_note(conn, inv["id"], "discount", date(2026, 10, 2), 250)
    assert cn["vat"] == 0
    q4 = core.calculate_return(conn, Q4)
    assert q4.box_str(1) == "0.00" and q4.box_str(6) == "0"
