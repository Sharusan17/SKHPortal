"""Stress tests for the printed invoice: every field at its longest allowed value, every box at its
line limit, big prices and odd characters. A PDF passes when no text overlaps other text, crosses a
box line or leaves the page, and every value is printed in full. invoice_fit (the app's check) must
accept exactly what prints cleanly and reject one character more."""
import copy
from datetime import date

import pytest

import core
import invoice_pdf
import pdf_layout

BUSINESS = {"company_name": "SKH Prestige Motors Ltd", "vrn": "468333470", "stagger": "MAR",
            "vat_reg_date": "2020-01-01", "accounting_scheme": "Standard (invoice)", "uses_margin_scheme": 1,
            "company_number": "12345678", "registered_office": "18 Whitethorns\nNewport Pagnell\nMK16 0AY",
            "phone": "07436 019191", "email": "info@skhinc.co.uk", "sort_code": "20-19-97",
            "account_no": "40839531"}
VEHICLE_KEYS = ["make", "model", "colour", "mileage", "engine_no", "chassis_no", "mfr_date", "wheel_nut",
                "immobiliser", "warranty_no", "radio_code", "order_no", "keys"]


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "vat.db")
    core.save_business(c, BUSINESS)
    core.add_car(c, "MF69 VPP", "BMW X5", core.MARGIN, date(2026, 10, 1), 25000)
    core.add_car(c, "GH78 IJK", "Audi A4", core.STANDARD, date(2026, 10, 1), 12000, 2000)
    yield c
    c.close()


def car_id(conn, reg="MF69 VPP") -> int:
    return conn.execute("SELECT id FROM cars WHERE reg = ?", (reg,)).fetchone()["id"]


def full_invoice(car_id) -> dict:
    """Every box filled to its line limit with ordinary values."""
    return {
        "vehicle_id": car_id, "invoice_date": "2026-10-09", "salesperson": "San", "margin_scheme": True,
        "buyer": {"name": "City Cars Scotland", "address": ["Murtle Den Road", "Milltimber", "Aberdeen", "AB13 0HS"],
                  "email": "sales@citycars.co.uk", "phone": "01224 548820"},
        "deliver_same": False,
        "deliver_to": {"name": "Ace Automotive", "address": ["18 Whitethorns", "Newport Pagnell", "Bucks", "MK16 0AY"],
                       "email": "ace@outlook.com", "phone": "07436 019195"},
        "vehicle": {"make": "BMW", "model": "X5 XDRIVE 30D", "colour": "Black", "first_reg": "2019-09-19",
                    "mileage": "53000", "engine_no": "N57D30A", "chassis_no": "WBA1234567", "mfr_date": "09/2019",
                    "wheel_nut": "17", "immobiliser": "Yes", "warranty_no": "W123", "radio_code": "1234",
                    "order_no": "O-77", "keys": "2"},
        "items": [{"desc": "Vehicle (MF69 VPP)", "qty": 1, "cost": 29500}]
                 + [{"desc": f"Mats set {i}", "qty": 2, "cost": 45.5} for i in range(8)],
        "warranty_lines": ["12 month warranty", "AA cover", "Service plan", "Paint protection", "Tyre cover"],
        "special_instructions": ["Soft Prep (£250)", "V5 Logbook", "2 Keys", "Full tank", "Mats fitted"],
        "pricing": {"selling_price": 29500, "delivery": 250, "accessories": 728, "rf_licence": 190,
                    "cherished": 80, "warranty": 450, "warranty_ipt": 54, "px_allowance": 5000,
                    "hp_settlement": 1200, "finance": 10000, "deposit": 1000},
    }


def render(conn, data, tmp_path, name="inv"):
    """(fields invoice_fit rejects, layout problems, printed text) for a draft, without saving it."""
    row, problems = core._invoice_input(conn, data)
    assert row, problems
    fields = core.invoice_fit(conn, row)
    inv = core._parse_invoice({**row, "invoice_no": core.next_invoice_no(conn)})
    out = tmp_path / f"{name}.pdf"
    invoice_pdf.build_invoice(core.invoice_document(conn, inv), out)
    return fields, pdf_layout.check(out), pdf_layout.text(out).replace("\n", " ")


# ---------------------------------------------------------------- whole invoices

@pytest.mark.parametrize("change, kind", [
    (lambda d: d["vehicle"].update(model="X5 XDRIVE 30D M SPORT EDITION PLUS"), "overlap"),
    (lambda d: d["items"][0].update(desc="Vehicle (MF69 VPP) plus extras"), "crosses line"),
    (lambda d: d["seller"].update(address_line="Unit 18 The Whitethorns Business Park, Newport Pagnell, "
                                               "Buckinghamshire, MK16 0AY"), "crosses line"),
])
def test_checker_catches_broken_layouts(tmp_path, change, kind):
    """The layout checker itself: drawing straight from invoice_pdf with values that don't fit."""
    d = copy.deepcopy(invoice_pdf.SAMPLE)
    change(d)
    invoice_pdf.build_invoice(d, tmp_path / "bad.pdf")
    assert kind in {p.kind for p in pdf_layout.check(tmp_path / "bad.pdf")}


def test_template_sample_is_clean(tmp_path):
    for margin in (False, True):
        d = copy.deepcopy(invoice_pdf.SAMPLE)
        d["margin_scheme"] = margin
        invoice_pdf.build_invoice(d, tmp_path / "s.pdf")
        assert pdf_layout.check(tmp_path / "s.pdf") == []


def test_every_box_full_is_clean_and_complete(conn, tmp_path):
    data = full_invoice(car_id(conn))
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    printed = [data["buyer"]["name"], *data["buyer"]["address"], data["buyer"]["email"], data["buyer"]["phone"],
               data["deliver_to"]["name"], *data["deliver_to"]["address"], *data["warranty_lines"],
               *data["special_instructions"], *(v for k, v in data["vehicle"].items() if k != "first_reg"),
               "19/09/2019", "SKH PRESTIGE MOTORS LTD", "18 Whitethorns, Newport Pagnell, MK16 0AY",
               "20-19-97", "40839531", "Margin scheme - second-hand goods"]
    printed += [it["desc"] for it in data["items"]]
    missing = [s for s in printed if s not in txt]
    assert missing == []
    t = data["pricing"]
    total = 29500 + 250 + 728 + 190 + 80 + 450 + 54
    for amount in (total, total - 5000, total - 5000 + 1200, total - 3800 - 10000, total - 3800 - 11000):
        assert invoice_pdf.money(amount) in txt
    assert t  # pricing used above


def test_standard_car_full_invoice_with_vat_line(conn, tmp_path):
    data = {**full_invoice(car_id(conn, "GH78 IJK")), "special_instructions": ["V5 Logbook", "2 Keys", "Full tank", "Mats"]}
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    assert "Incl. VAT at 20%: £5,079.67" in txt and "Margin scheme" not in txt


def test_minimal_invoice_prints_dashes_not_none(conn, tmp_path):
    data = {"vehicle_id": car_id(conn), "invoice_date": "2026-10-09", "buyer": {"name": "A", "address": ["B"]},
            "items": [], "pricing": {"selling_price": 1}}
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    assert not {"None", "nan", "NaN"} & set(txt.split())
    assert txt.count("£0.00") >= 10  # unused price rows print £0.00 rather than a blank
    assert "Salesperson -" in txt  # blank text prints a dash
    assert txt.count(" - ") + txt.count("-\n") >= 10  # empty vehicle fields show a dash


# ---------------------------------------------------------------- line limits

@pytest.mark.parametrize("key, limit, make", [
    ("items", 9, lambda i: {"desc": f"Item {i}", "qty": 1, "cost": 10}),
    ("warranty_lines", 5, lambda i: f"Warranty {i}"),
    ("special_instructions", 5, lambda i: f"Note {i}"),
])
def test_box_line_limits(conn, tmp_path, key, limit, make):
    data = full_invoice(car_id(conn))
    data[key] = [make(i) for i in range(limit)]
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    last = data[key][-1]["desc"] if key == "items" else data[key][-1]
    assert last in txt
    data[key].append(make(limit))
    with pytest.raises(ValueError, match="fit on the invoice"):
        core._clean_invoice(conn, data)


def test_standard_car_has_one_less_special_line(conn):
    data = {**full_invoice(car_id(conn, "GH78 IJK")), "special_instructions": [f"Note {i}" for i in range(5)]}
    with pytest.raises(ValueError, match=r"Only 4 special instructions fit .*VAT"):
        core._clean_invoice(conn, data)


@pytest.mark.parametrize("who", ["buyer", "deliver_to"])
def test_four_address_lines_print_and_a_fifth_is_refused(conn, tmp_path, who):
    data = full_invoice(car_id(conn))
    data[who]["address"] = ["Line one", "Line two", "Line three", "Line four"]
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == [] and "Line four" in txt
    data[who]["address"].append("Line five")
    with pytest.raises(ValueError, match="address lines fit"):
        core._clean_invoice(conn, data)


def test_line_spacing_matches_template(conn, tmp_path):
    """Rows sit where the Word template puts them: same gaps between lines in every block."""
    data = full_invoice(car_id(conn))
    render(conn, data, tmp_path)
    runs = pdf_layout.text_runs(tmp_path / "inv.pdf")

    def tops(prefix_texts):
        return [next(r["top"] for r in runs if r["text"].replace(" ", "") == s.replace(" ", ""))
                for s in prefix_texts]

    def gaps(ys):
        return [round(b - a, 1) for a, b in zip(ys, ys[1:])]

    assert gaps(tops([data["buyer"]["name"], *data["buyer"]["address"]])) == [9.8] * 4
    assert gaps(tops([it["desc"] for it in data["items"]])) == [12.3] * 8
    assert gaps(tops(data["warranty_lines"])) == [12.3] * 4
    assert set(gaps(tops(data["special_instructions"]))) <= {12.2, 12.3}
    assert gaps(tops(["Reg No", "Colour", "First Reg Date", "Wheel Nut No", "Immobiliser"])) == [18.5, 18.2, 18.2, 18.3]


# ---------------------------------------------------------------- longest allowed values

def _set(data, key, value):
    part, _, rest = key.partition(".")
    if part in ("buyer", "deliver_to"):
        if rest == "address":
            data[part]["address"][0] = value
        else:
            data[part][rest] = value
    elif part == "vehicle":
        data["vehicle"][rest] = value
    elif part == "items":
        data["items"][0]["desc"] = value
    elif part in ("warranty_lines", "special_instructions"):
        data[part][0] = value
    else:
        data[part] = value


TEXT_FIELDS = (["buyer.name", "buyer.address", "buyer.email", "buyer.phone", "deliver_to.name",
                "deliver_to.address", "deliver_to.email", "deliver_to.phone", "salesperson",
                "items.0.desc", "warranty_lines", "special_instructions"]
               + [f"vehicle.{k}" for k in VEHICLE_KEYS])


@pytest.mark.parametrize("key", TEXT_FIELDS)
def test_longest_accepted_text_prints_cleanly(conn, tmp_path, key):
    """Find the longest value invoice_fit accepts (wide letters, the worst case), then check the PDF."""
    pattern = "MW0m" if key != "vehicle.mileage" else "8"

    def value(n):
        return (pattern * 60)[:n]

    def accepted(n):
        data = full_invoice(car_id(conn))
        _set(data, key, value(n))
        row, _ = core._invoice_input(conn, data)
        return key not in core.invoice_fit(conn, row)

    lo, hi = 1, 200
    assert accepted(lo) and not accepted(hi)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        lo, hi = (mid, hi) if accepted(mid) else (lo, mid)
    data = full_invoice(car_id(conn))
    _set(data, key, value(lo))
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == [], (lo, layout)
    assert value(lo) in txt.replace(" ", "")
    assert lo >= {"buyer.name": 20, "items.0.desc": 9, "vehicle.model": 15, "vehicle.chassis_no": 10,
                  "salesperson": 6}.get(key, 3), f"{key} only allows {lo} characters"


@pytest.mark.parametrize("key", ["selling_price", "delivery", "accessories", "rf_licence", "cherished",
                                 "warranty", "warranty_ipt", "px_allowance", "hp_settlement", "finance",
                                 "deposit"])
def test_largest_accepted_price_prints_cleanly(conn, tmp_path, key):
    data = full_invoice(car_id(conn))

    def accepted(amount):
        d = copy.deepcopy(data)
        d["pricing"][key] = amount
        row, _ = core._invoice_input(conn, d)
        return not core.invoice_fit(conn, row)

    assert accepted(99_999.99), "five-figure prices must fit everywhere"
    amount = 99_999.99
    while accepted(amount * 10):
        amount *= 10
    data["pricing"][key] = amount
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    assert invoice_pdf.money(amount) in txt


def test_quantity_and_cost_limits(conn, tmp_path):
    data = full_invoice(car_id(conn))
    data["items"][1].update(qty=99, cost=999.99)
    fields, layout, _ = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    data["items"][1].update(qty=99, cost=99999.99)  # items total would pass £10m
    row, _ = core._invoice_input(conn, data)
    assert "Items total" in core.invoice_fit(conn, row)["items"]
    data["items"][1].update(qty=99, cost=999.99)
    data["items"][1]["qty"] = 100
    with pytest.raises(ValueError, match="1 to 99"):
        core._clean_invoice(conn, data)


@pytest.mark.parametrize("field, value", [
    ("company_name", "SKH Prestige Motors and Vehicle Sourcing Group Limited"),
    ("registered_office", "Unit 18 The Whitethorns Business Park\nNewport Pagnell\nBuckinghamshire\nMK16 0AY"),
])
def test_long_seller_details_are_refused(conn, tmp_path, field, value):
    core.save_business(conn, {**BUSINESS, field: value})
    row, _ = core._invoice_input(conn, full_invoice(car_id(conn)))
    fields = core.invoice_fit(conn, row)
    assert any(k.startswith("seller.") for k in fields), fields
    assert "Business page" in " ".join(fields.values())


# ---------------------------------------------------------------- logo

@pytest.mark.parametrize("size", [(400, 400), (1000, 100), (293, 161), (100, 600)])
def test_logo_is_padded_not_stretched(size):
    from PIL import Image

    src = Image.new("RGB", size, "navy")
    out = core.fit_logo(src)
    assert abs(out.width / out.height - 96 / 52.5) < 0.01
    assert out.width >= src.width and out.height >= src.height  # nothing cropped
    box = out.getchannel("A").getbbox()  # the logo itself, centred and its own shape
    assert (box[2] - box[0], box[3] - box[1]) == size


# ---------------------------------------------------------------- characters

def test_western_accents_and_symbols_print(conn, tmp_path):
    data = full_invoice(car_id(conn))
    data["buyer"]["name"] = "José O'Brien & Søn"
    data["buyer"]["address"][0] = "€5 – “quoted” café"
    fields, layout, txt = render(conn, data, tmp_path)
    assert fields == {} and layout == []
    assert "José O'Brien & Søn" in txt and "café" in txt


def test_letters_the_font_cannot_print_are_refused(conn):
    data = full_invoice(car_id(conn))
    data["buyer"]["name"] = "Łukasz Żółć"
    row, _ = core._invoice_input(conn, data)
    if invoice_pdf._fonts()[0]["R"] != "Helvetica":
        pytest.skip("Aptos fonts installed; they print these letters")
    msg = core.invoice_fit(conn, row)["buyer.name"]
    assert "Ł" in msg and "can't print" in msg


def test_failed_checks_use_no_invoice_number(conn):
    data = full_invoice(car_id(conn))
    data["salesperson"] = "W" * 40
    with pytest.raises(ValueError, match="Salesperson is too long"):
        core.create_invoice(conn, data)
    assert core.next_invoice_no(conn) == "0001" and not core.has_invoices(conn)
