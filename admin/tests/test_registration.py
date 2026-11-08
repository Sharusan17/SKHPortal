"""VAT from the registration date, the invoice footer address, and profit after running costs."""
from datetime import date
from decimal import Decimal

import pytest

import core
from test_invoices import BUSINESS

Q2 = core.Quarter(date(2026, 4, 1), date(2026, 6, 30))
Q3 = core.Quarter(date(2026, 7, 1), date(2026, 9, 30))
Q4 = core.Quarter(date(2026, 10, 1), date(2026, 12, 31))


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "v.db")
    core.save_business(c, {**BUSINESS, "vat_reg_date": "2026-09-01"})
    # Bought and sold before registration: no VAT either way.
    core.add_car(c, "AA11 AAA", "Ford Fiesta", core.MARGIN, date(2026, 7, 2), 3000, sale_date=date(2026, 8, 10),
                     sale_price=4200)
    # VAT-qualifying, bought before and sold after: purchase VAT claimed on the first return.
    b = core.add_car(c, "BB22 BBB", "Audi A4", core.STANDARD, date(2026, 8, 5), 12000, 2000,
                     sale_date=date(2026, 10, 6), sale_price=14400)
    core.update_car(c, b, {"buyer_fee": 300, "buyer_fee_vat": 50})
    # Margin, bought before, sold in the first return period.
    core.add_car(c, "CC33 CCC", "VW Golf", core.MARGIN, date(2026, 8, 20), 5000, sale_date=date(2026, 9, 15),
                 sale_price=6200)
    # Margin, bought and sold after.
    core.add_car(c, "DD44 DDD", "Kia Ceed", core.MARGIN, date(2026, 9, 10), 4000, sale_date=date(2026, 9, 25),
                 sale_price=4600)
    core.add_transaction(c, date(2026, 8, 3), "Autotrader before", -120, core.EXPENSE_VAT)  # £20 VAT, not claimed
    core.add_transaction(c, date(2026, 9, 3), "Autotrader after", -120, core.EXPENSE_VAT)   # £20 VAT, claimed
    core.add_transaction(c, date(2026, 9, 4), "Rent", -600, core.EXPENSE_NO_VAT)
    core.add_transaction(c, date(2026, 9, 6), "Valet for a customer", 60, core.OTHER_SALE_VAT)
    yield c
    c.close()


def test_first_return_starts_on_registration_date(conn):
    r = core.calculate_return(conn, Q3)
    assert r.vat_from == date(2026, 9, 1) and r.registered
    # Box 1: CC33 margin 1200/6 = 200, DD44 600/6 = 100, valet 10. AA11 (sold in Aug) is left out.
    assert r.box_str(1) == "310.00"
    # Box 4: BB22 purchase VAT 2000 + fee VAT 50 (still held on 1 Sep) + Autotrader after 20.
    assert r.box_str(4) == "2070.00"
    # Box 6: 6200-200 + 4600-100 + 60-10 = 10550. Box 7: DD44 4000 + BB22 10000 + fee 250 + 100 + 600.
    assert r.box_str(6) == "10550" and r.box_str(7) == "14950"
    assert any("before registration" in w and "£20.00" in w for w in r.warnings)
    assert any("1 car sold before registration" in w for w in r.warnings)


def test_quarter_before_registration_has_no_return(conn):
    r = core.calculate_return(conn, Q2)
    assert not r.registered and all(v == 0 for v in r.boxes.values())
    with pytest.raises(ValueError, match="wasn't VAT registered"):
        core.mark_filed(conn, Q2, date(2026, 7, 5))


def test_later_quarter_is_whole(conn):
    r = core.calculate_return(conn, Q4)
    assert r.vat_from == Q4.start and r.box_str(1) == "2400.00"  # BB22 14400 / 6


def test_cars_sold_before_registration_carry_no_vat(conn):
    cars = {c["reg"]: c for c in core.car_overview(conn, date(2026, 11, 8))}
    a = cars["AA11 AAA"]
    assert a["vat_due"] == 0 and a["profit"] == Decimal("1200.00")
    b = cars["BB22 BBB"]  # VAT reclaimed, so cost is net
    assert b["bought_for"] == Decimal("10250") and b["vat_due"] == Decimal("2400.00")


def test_expenses_before_registration_have_no_vat(conn):
    e = core.expenses(conn, Q3)
    before = next(x for x in e["lines"] if x["description"] == "Autotrader before")
    assert before["vat"] == 0 and before["before_vat_reg"] and not before["needs_receipt"]
    assert e["totals"]["vat"] == Decimal("20.00")
    assert core.quarter_progress(conn, Q3).receipts_needed == 1


def test_footer_address_drops_the_country():
    s = core.seller_details({"registered_office": "Unit 82a James Carter Road, Bury St. Edmunds, IP28 7DE, United Kingdom"})
    assert s["address_line"] == "Unit 82a James Carter Road, Bury St. Edmunds, IP28 7DE"
    assert core.seller_details({"registered_office": "UK"})["address_line"] == "UK"


def test_profit_and_loss(conn):
    pnl = core.profit_and_loss(conn, Q3)
    # Car profit: AA11 1200, CC33 6200-200-5000 = 1000, DD44 4600-100-4000 = 500.
    assert pnl["car_profit"] == Decimal("2700.00")
    # Running costs: Autotrader before 120 (no VAT back) + after 100 + rent 600.
    assert pnl["running_costs"] == Decimal("820.00") and pnl["other_income"] == Decimal("50.00")
    assert pnl["net_profit"] == Decimal("1930.00") and pnl["cars_sold"] == 3
