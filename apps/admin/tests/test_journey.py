"""The car's journey: statuses, auction fees, costs, documents, invoice payments, Home summary."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import core
import server
from test_core import Q3, import_bank, seed_cars
from test_invoices import BUSINESS, invoice

TODAY = date(2026, 11, 8)


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "vat.db")
    core.save_business(c, BUSINESS)
    yield c
    c.close()


def test_q3_figures_unchanged_and_detail_adds_up(conn):
    seed_cars(conn)
    import_bank(conn)
    r = core.calculate_return(conn, Q3)
    assert [r.box_str(n) for n in range(1, 10)] == ["2670.00", "0.00", "2670.00", "2060.00", "610.00",
                                                     "21150", "22540", "0", "0"]
    for box in (1, 4, 6, 7):  # the drill-down lists exactly what's in each box
        total = sum((d["amount"] for d in r.detail if d["box"] == box), Decimal(0))
        assert core.box_str(box, core.pence(total) if box < 5 else core.whole_pounds(total)) == r.box_str(box)
    assert any(d["kind"] == "car" and d["label"] == "AB12 CDE sold" for d in r.detail)
    assert any(d["kind"] == "bank" and "Shell fuel" in d["label"] for d in r.detail)


def test_status_moves_and_stamps_date(conn):
    car = core.add_car(conn, "AA11 AAA", "Ford Fiesta", core.MARGIN, date(2026, 10, 1), 3000)
    assert core.car_overview(conn, TODAY)[0]["stage"] == "bought"
    assert core.car_overview(conn, TODAY)[0]["bill_paid"] is False
    core.update_car(conn, car, {"purchase_paid_on": "2026-10-02"})
    c = core.car_overview(conn, TODAY)[0]
    assert c["stage"] == "bought" and c["bill_paid"] is True  # paying the bill is a flag, not a stage
    with pytest.raises(ValueError, match="Unknown status"):
        core.update_car(conn, car, {"status": "reserved"})  # retired stage
    core.update_car(conn, car, {"status": "in_prep"})
    c = core.car_overview(conn, TODAY)[0]
    assert c["stage"] == "in_prep" and c["status_at"] == date.today()
    with pytest.raises(ValueError, match="Unknown status"):
        core.update_car(conn, car, {"status": "teleported"})
    with pytest.raises(ValueError, match="Can't change"):
        core.update_car(conn, car, {"sale_price": 1})


def test_retired_stages_are_moved_on_open(tmp_path):
    c = core.connect(tmp_path / "v.db")
    a = core.add_car(c, "AA11 AAA", "A", core.MARGIN, date(2026, 10, 1), 1000)
    b = core.add_car(c, "BB22 BBB", "B", core.MARGIN, date(2026, 10, 1), 1000)
    c.execute("UPDATE cars SET status = 'bill_paid' WHERE id = ?", (a,))
    c.execute("UPDATE cars SET status = 'reserved' WHERE id = ?", (b,))
    c.commit()
    c.close()
    c = core.connect(tmp_path / "v.db")
    assert {r["reg"]: r["status"] for r in c.execute("SELECT reg, status FROM cars")} == {
        "AA11 AAA": "bought", "BB22 BBB": "for_sale"}
    c.close()


def test_buyer_fee_in_margin_or_reclaimed(conn):
    """No VAT on the fee: it's part of the margin purchase price. VAT shown: Box 4, not the margin."""
    a = core.add_car(conn, "AA11 AAA", "Car A", core.MARGIN, date(2026, 7, 1), 3000)
    core.update_car(conn, a, {"buyer_fee": 300})
    core.record_sale(conn, a, date(2026, 8, 1), 4500)
    r = core.calculate_return(conn, Q3)
    assert r.box_str(1) == "200.00"  # (4500 - 3300) / 6
    assert r.box_str(7) == "3300"

    b = core.add_car(conn, "BB22 BBB", "Car B", core.MARGIN, date(2026, 7, 1), 3000)
    core.update_car(conn, b, {"buyer_fee": 360, "buyer_fee_vat": 60})
    core.record_sale(conn, b, date(2026, 8, 1), 4500)
    r = core.calculate_return(conn, Q3)
    assert r.box_str(1) == "450.00"  # 200 + (4500 - 3000) / 6
    assert r.box_str(4) == "60.00"
    assert r.box_str(7) == "6600"  # 3300 + 3000 + 300 net fee
    with pytest.raises(ValueError, match="more than the fee"):
        core.update_car(conn, b, {"buyer_fee_vat": 500})


def test_costs_linked_to_car_feed_profit_not_vat(conn):
    car = core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 6, 10), 3000)
    core.record_sale(conn, car, date(2026, 7, 20), 4500)
    import_bank(conn)
    before = core.calculate_return(conn, Q3)
    fuel = conn.execute("SELECT id FROM transactions WHERE description = 'Shell fuel'").fetchone()["id"]
    core.link_transaction(conn, fuel, car)
    after = core.calculate_return(conn, Q3)
    assert [after.box_str(n) for n in range(1, 10)] == [before.box_str(n) for n in range(1, 10)]
    c = core.car_overview(conn, TODAY)[0]
    assert c["costs_net"] == Decimal("50.00")
    assert c["profit"] == Decimal("4500") - Decimal("250.00") - Decimal("3000") - Decimal("50.00")


def test_payments_and_stage_completed(conn):
    car = core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 10, 1), 3000)
    inv = core.create_invoice(conn, invoice(car, 4500, "2026-10-20", pricing={"selling_price": 4500, "deposit": 500}))
    status = core.payment_status(conn, inv)
    assert (status["due"], status["paid"], status["status"]) == (Decimal("4500.00"), Decimal("500.00"), "part_paid")
    assert core.car_overview(conn, TODAY)[0]["stage"] == "sold"
    txn = core.add_transaction(conn, "2026-10-21", "J Bloggs balance", 4000)
    core.pay_invoice_from_bank(conn, txn, inv["id"])
    assert core.payment_status(conn, inv)["status"] == "paid"
    assert core.car_overview(conn, TODAY)[0]["stage"] == "completed"
    t = conn.execute("SELECT category, car_id FROM transactions WHERE id = ?", (txn,)).fetchone()
    assert (t["category"], t["car_id"]) == (core.CAR_SALE, car)  # not counted twice in VAT
    with pytest.raises(ValueError, match="already recorded"):
        core.pay_invoice_from_bank(conn, txn, inv["id"])


def test_home_summary(conn):
    a = core.add_car(conn, "AA11 AAA", "Car A", core.MARGIN, date(2026, 10, 1), 3000)
    core.add_car(conn, "BB22 BBB", "Car B", core.MARGIN, date(2026, 10, 2), 5000)
    core.update_car(conn, a, {"status": "in_prep"})
    conn.execute("UPDATE cars SET status_at = '2026-10-10' WHERE id = ?", (a,))
    core.add_transaction(conn, "2026-10-05", "Mystery", -20)
    h = core.home_summary(conn, TODAY)
    assert h["stock"]["count"] == 2 and h["stock"]["at_cost"] == Decimal("8000")
    texts = " | ".join(x["text"] for x in h["actions"])
    assert "AA11 AAA: in prep for 29 days" in texts
    assert "BB22 BBB: purchase bill not marked paid" in texts
    assert "no purchase invoice kept" in texts and "1 bank line to categorise" in texts
    assert h["next_to_file"]["quarter"] == "Jul-Sep 2026"


def test_documents_and_customers(conn, tmp_path):
    car = core.add_car(conn, "AA11 AAA", "Car A", core.MARGIN, date(2026, 10, 1), 3000)
    doc = core.add_car_document(conn, car, "Purchase invoice", "bca.pdf", b"%PDF")
    assert core.list_car_documents(conn, car)[0]["filename"] == "bca.pdf"
    assert "no purchase invoice kept" not in " ".join(a["text"] for a in core.home_summary(conn, TODAY)["actions"])
    core.delete_car_document(conn, doc)
    assert core.list_car_documents(conn, car) == []
    core.create_invoice(conn, invoice(car, 4500, "2026-10-20", buyer="City Cars Ltd"))
    assert core.customers(conn)[0]["name"] == "City Cars Ltd"


def test_journey_endpoints(tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "vat.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782"}).raise_for_status()
    client.post("/api/cars", json={"reg": "aa11 aaa", "scheme": "Margin", "purchase_date": "2026-10-01",
                                   "purchase_price": 3000}).raise_for_status()
    car = client.get("/api/stock").json()[0]
    assert car["stage"] == "bought" and car["days_in_stock"] is not None
    assert client.patch(f"/api/cars/{car['id']}", json={"status": "for_sale", "asking_price": 4995}).status_code == 200
    assert client.patch(f"/api/cars/{car['id']}", json={"status": "nope"}).status_code == 400
    assert client.get("/api/stock").json()[0]["stage"] == "for_sale"
    r = client.post(f"/api/cars/{car['id']}/documents", files=[("files", ("bca.pdf", b"%PDF-1.4"))])
    assert r.status_code == 200
    doc = client.get(f"/api/cars/{car['id']}/documents").json()[0]
    assert client.get(f"/api/documents/{doc['id']}/file").content == b"%PDF-1.4"
    home = client.get("/api/home").json()
    assert home["stock"]["count"] == 1 and "actions" in home
    inv = client.post("/api/invoices", json=invoice(car["id"], 4995, "2026-10-20")).json()
    assert inv["payment"]["status"] == "unpaid"
    client.post(f"/api/invoices/{inv['id']}/payments", json={"paid_on": "2026-10-21", "amount": 4995}).raise_for_status()
    p = client.get(f"/api/invoices/{inv['id']}/payments").json()
    assert p["status"] == "paid" and len(p["payments"]) == 1
    assert client.get("/api/invoices/customers").json()[0]["name"] == "J Bloggs"
    meta = client.get("/api/meta").json()
    assert meta["car_statuses"]["in_prep"] == "In prep"
