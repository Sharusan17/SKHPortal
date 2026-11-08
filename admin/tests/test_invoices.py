"""Sales invoices: numbering, the stock-book sale they record, voiding and the margin-scheme flag."""
import copy
from datetime import date

import pdfplumber
import pytest

import core
import invoice_pdf
from test_core import Q3, import_bank

BUSINESS = {"company_name": "Test Motors Ltd", "vrn": "123456782", "stagger": "MAR",
            "vat_reg_date": "2020-01-01", "accounting_scheme": "Standard (invoice)",
            "uses_margin_scheme": 1, "registered_office": "1 High Street\nNewport Pagnell\nMK16 0AY",
            "company_number": "01234567", "phone": "01908 000000", "email": "sales@test.co.uk"}


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "vat.db")
    core.save_business(c, BUSINESS)
    yield c
    c.close()


def invoice(car_id, price, on, buyer="J Bloggs", **extra):
    return {"vehicle_id": car_id, "invoice_date": on, "salesperson": "San",
            "buyer": {"name": buyer, "address": ["2 Low Road", "Milton Keynes"]},
            "items": [{"desc": "Vehicle", "qty": 1, "cost": price}],
            "pricing": {"selling_price": price}, "margin_scheme": True, **extra}


def unsold_q3_cars(conn):
    """The Q3 test cars from test_core, bought but not yet sold."""
    return {
        "AB12 CDE": core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 6, 10), 3000),
        "CD34 EFG": core.add_car(conn, "CD34 EFG", "VW Golf", core.MARGIN, date(2026, 8, 1), 5000),
        "EF56 GHI": core.add_car(conn, "EF56 GHI", "BMW 320d", core.MARGIN, date(2026, 9, 15), 7000),
        "GH78 IJK": core.add_car(conn, "GH78 IJK", "Audi A4", core.STANDARD, date(2026, 7, 5), 12000, 2000),
    }


def test_invoice_marks_car_sold_and_q3_figures_match(conn):
    cars = unsold_q3_cars(conn)
    import_bank(conn)
    for reg, price, on in (("AB12 CDE", 4500, "2026-07-20"), ("CD34 EFG", 4800, "2026-09-01"),
                           ("GH78 IJK", 14400, "2026-08-20")):
        inv = core.create_invoice(conn, invoice(cars[reg], price, on, buyer=f"Buyer of {reg}"))
        assert core.invoice_path(conn, inv).exists()

    car = core._car(conn, cars["AB12 CDE"])
    assert car["sale_date"] == date(2026, 7, 20) and car["sale_price"] == 4500
    assert car["buyer_name"] == "Buyer of AB12 CDE" and car["sales_invoice_no"] == "0001"

    r = core.calculate_return(conn, Q3)
    assert {n: r.box_str(n) for n in range(1, 10)} == {
        1: "2670.00", 2: "0.00", 3: "2670.00", 4: "2060.00", 5: "610.00",
        6: "21150", 7: "22540", 8: "0", 9: "0"}


def test_invoice_numbers_are_sequential_without_gaps(conn):
    core.save_business(conn, {**BUSINESS, "invoice_start": 24})
    ids = [core.add_car(conn, f"AA{i} AAA", "Car", core.MARGIN, date(2026, 10, 1), 1000) for i in range(4)]
    a = core.create_invoice(conn, invoice(ids[0], 2000, "2026-10-05"))
    with pytest.raises(ValueError, match="buyer's address"):  # a failed attempt uses no number
        core.create_invoice(conn, {**invoice(ids[1], 2000, "2026-10-05"), "buyer": {"name": "X"}})
    b = core.create_invoice(conn, invoice(ids[1], 2000, "2026-10-06"))
    core.void_invoice(conn, b["id"])  # a void keeps its number
    c = core.create_invoice(conn, invoice(ids[2], 2000, "2026-10-07"))
    assert [a["invoice_no"], b["invoice_no"], c["invoice_no"]] == ["0024", "0025", "0026"]
    with pytest.raises(ValueError, match="can't change once an invoice"):
        core.save_business(conn, {**BUSINESS, "invoice_start": 1})


def test_void_removes_sale_from_vat_return(conn):
    cars = unsold_q3_cars(conn)
    inv = core.create_invoice(conn, invoice(cars["AB12 CDE"], 4500, "2026-07-20"))
    assert core.calculate_return(conn, Q3).box_str(1) == "250.00"

    voided = core.void_invoice(conn, inv["id"])
    assert voided["void"] and voided["invoice_no"] == "0001"
    car = core._car(conn, cars["AB12 CDE"])
    assert car["sale_date"] is None and car["sales_invoice_no"] is None
    assert core.calculate_return(conn, Q3).box_str(1) == "0.00"
    with pytest.raises(ValueError, match="void"):
        core.update_invoice(conn, inv["id"], invoice(cars["AB12 CDE"], 4500, "2026-07-20"))
    # the car can be invoiced again, under a new number
    assert core.create_invoice(conn, invoice(cars["AB12 CDE"], 4600, "2026-07-21"))["invoice_no"] == "0002"


def test_margin_scheme_forced_off_for_standard_cars(conn, tmp_path):
    cars = unsold_q3_cars(conn)
    inv = core.create_invoice(conn, invoice(cars["GH78 IJK"], 14400, "2026-08-20", margin_scheme=True))
    assert inv["margin_scheme"] is False
    text = pdfplumber.open(core.invoice_path(conn, inv)).pages[0].extract_text()
    assert "Margin scheme" not in text
    assert "Incl. VAT at 20%: £2,400.00" in text

    inv = core.create_invoice(conn, invoice(cars["AB12 CDE"], 4500, "2026-07-20", margin_scheme=True))
    assert inv["margin_scheme"] is True
    assert "Margin scheme - second-hand goods" in pdfplumber.open(core.invoice_path(conn, inv)).pages[0].extract_text()


def test_edit_regenerates_and_moves_sale(conn):
    cars = unsold_q3_cars(conn)
    inv = core.create_invoice(conn, invoice(cars["AB12 CDE"], 4500, "2026-07-20"))
    edited = core.update_invoice(conn, inv["id"], invoice(cars["EF56 GHI"], 9000, "2026-09-30", buyer="New Buyer"))
    assert edited["invoice_no"] == "0001" and edited["buyer_name"] == "New Buyer"
    assert core._car(conn, cars["AB12 CDE"])["sale_date"] is None  # old car back in stock
    moved = core._car(conn, cars["EF56 GHI"])
    assert moved["sale_price"] == 9000 and moved["sales_invoice_no"] == "0001"
    assert not core.invoice_path(conn, inv).exists() and core.invoice_path(conn, edited).exists()
    text = pdfplumber.open(core.invoice_path(conn, edited)).pages[0].extract_text()
    assert "New Buyer" in text and "EF56 GHI" in text


def test_validation(conn):
    car = core.add_car(conn, "ZZ11 ZZZ", "Kia", core.MARGIN, date(2026, 10, 1), 1000)
    with pytest.raises(ValueError, match="selling price"):
        core.create_invoice(conn, invoice(car, 0, "2026-10-05"))
    core.save_business(conn, {**BUSINESS, "registered_office": ""})
    with pytest.raises(ValueError, match="registered office address"):
        core.create_invoice(conn, invoice(car, 2000, "2026-10-05"))
    core.save_business(conn, BUSINESS)
    with pytest.raises(ValueError, match="special instruction is too long"):
        core.create_invoice(conn, invoice(car, 2000, "2026-10-05",
                                          special_instructions=["Full valet and soft prep before delivery"]))
    core.create_invoice(conn, invoice(car, 2000, "2026-10-05"))
    with pytest.raises(ValueError, match="already marked sold"):
        core.create_invoice(conn, invoice(car, 2000, "2026-10-05"))


def test_totals_match_build_invoice(tmp_path):
    d = copy.deepcopy(invoice_pdf.SAMPLE)
    d["pricing"].update(delivery=200, accessories=150, warranty=450, warranty_ipt=54, px_allowance=5000,
                        hp_settlement=1200, finance=10000, deposit=1000)
    drawn = invoice_pdf.build_invoice(d, tmp_path / "inv.pdf")
    ours = core.invoice_totals(d["items"], d["pricing"])
    assert {k: ours[k] for k in drawn} == drawn


def test_extras_are_warned_and_stock_numbers(conn):
    car = core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 6, 10), 3000)
    assert core._car(conn, car)["stock_no"] == "0001"
    core.create_invoice(conn, invoice(car, 4500, "2026-07-20", pricing={"selling_price": 4500, "delivery": 120}))
    warns = core.calculate_return(conn, Q3).warnings
    assert any("Invoice 0001 (AB12 CDE) also charges delivery £120.00" in w for w in warns)
    assert core.calculate_return(conn, Q3).box_str(1) == "250.00"  # only the car
    with pytest.raises(ValueError, match="has an invoice"):
        core.save_cars(conn, [], shown_ids={car})
