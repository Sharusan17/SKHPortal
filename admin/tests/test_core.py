from datetime import date
from decimal import Decimal

import pandas as pd
import pytest
import requests

import core
import lookups

Q3 = core.quarter_for(date(2026, 8, 1), "MAR")

TIDE_CSV = pd.DataFrame(
    [
        ["02/07/2026", "TXN001", "Card payment", "Valeting - J Smith", "120.00", "", "1,120.00"],
        ["09/07/2026", "TXN002", "Card payment", "Shell fuel", "", "60.00", "1,060.00"],
        ["14/07/2026", "TXN003", "Card payment", "AutoTrader advert", "", "£300.00", "760.00"],
        ["01/08/2026", "TXN004", "Direct debit", "Motor trade insurance", "", "240.00", "520.00"],
        ["05/08/2026", "TXN005", "Transfer", "Directors loan", "1,000.00", "", "1,520.00"],
        ["28/09/2026", "TXN006", "Direct debit", "HMRC VAT", "", "500.00", "1,020.00"],
    ],
    columns=["Date", "Transaction ID", "Transaction Type", "Transaction description",
             "Paid in", "Paid out", "Balance"],
)

RULES = [("valet", core.OTHER_SALE_VAT), ("fuel", core.EXPENSE_VAT), ("advert", core.EXPENSE_VAT),
         ("insurance", core.EXPENSE_NO_VAT), ("loan", core.EXCLUDE), ("hmrc", core.EXCLUDE)]


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "vat.db")
    yield c
    c.close()


def seed_cars(conn):
    core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 6, 10), 3000, None,
                 date(2026, 7, 20), 4500)
    core.add_car(conn, "CD34 EFG", "VW Golf", core.MARGIN, date(2026, 8, 1), 5000, None,
                 date(2026, 9, 1), 4800)
    core.add_car(conn, "EF56 GHI", "BMW 320d", core.MARGIN, date(2026, 9, 15), 7000)
    core.add_car(conn, "GH78 IJK", "Audi A4", core.STANDARD, date(2026, 7, 5), 12000, 2000,
                 date(2026, 8, 20), 14400)


def import_bank(conn):
    core.save_rules(conn, RULES)
    return core.import_transactions(conn, TIDE_CSV, core.detect_columns(list(TIDE_CSV.columns)))


def test_q3_2026_return(conn):
    seed_cars(conn)
    res = import_bank(conn)
    assert (res.added, res.skipped, res.failed) == (6, 0, [])

    r = core.calculate_return(conn, Q3)
    expected = {1: "2670.00", 2: "0.00", 3: "2670.00", 4: "2060.00", 5: "610.00",
                6: "21150", 7: "22540", 8: "0", 9: "0"}
    assert {n: r.box_str(n) for n in range(1, 10)} == expected
    assert r.boxes[1] == Decimal("2670.00")

    sold = {c["reg"]: c for c in r.cars_sold}
    assert sold["AB12 CDE"]["margin"] == Decimal("1500.00")
    assert sold["AB12 CDE"]["output_vat"] == Decimal("250.00")
    assert sold["CD34 EFG"]["output_vat"] == Decimal("0.00")  # loss: no VAT, no offset
    assert sold["GH78 IJK"]["output_vat"] == Decimal("2400.00")
    assert "EF56 GHI" not in sold


def test_column_detection_and_signed_amounts(conn):
    mapping = core.detect_columns(list(TIDE_CSV.columns))
    assert mapping == {"date": "Date", "description": "Transaction description", "paid_in": "Paid in",
                       "paid_out": "Paid out", "amount": None}
    import_bank(conn)
    df = core.get_transactions_df(conn, Q3)
    assert df["amount"].tolist() == [120.0, -60.0, -300.0, -240.0, 1000.0, -500.0]
    assert df["vat"].tolist() == [20.0, 10.0, 50.0, 0.0, 0.0, 0.0]
    assert df["date"].iloc[0] == date(2026, 7, 2)  # parsed day-first


def test_reimport_same_csv_adds_nothing(conn):
    assert import_bank(conn).added == 6
    again = import_bank(conn)
    assert (again.added, again.skipped) == (0, 6)


def test_identical_rows_in_one_file_are_both_kept(conn):
    raw = pd.DataFrame([["03/07/2026", "Card fee", "-5.00"]] * 2, columns=["Date", "Description", "Amount"])
    mapping = core.detect_columns(list(raw.columns))
    assert core.import_transactions(conn, raw, mapping).added == 2
    assert core.import_transactions(conn, raw, mapping).added == 0


def test_category_change_resets_vat_unless_hand_edited(conn):
    tid = core.add_transaction(conn, date(2026, 7, 9), "Parts", "-90.00")
    df = core.get_transactions_df(conn, Q3)
    df.loc[df.id == tid, "category"] = core.EXPENSE_VAT
    core.update_transactions(conn, df)
    assert core.get_transactions_df(conn, Q3)["vat"].iloc[0] == 15.0

    df = core.get_transactions_df(conn, Q3)
    df.loc[df.id == tid, "vat"] = 12.34
    core.update_transactions(conn, df)
    df = core.get_transactions_df(conn, Q3)
    df.loc[df.id == tid, "category"] = core.OTHER_SALE_VAT
    core.update_transactions(conn, df)
    assert core.get_transactions_df(conn, Q3)["vat"].iloc[0] == 12.34


def test_warnings(conn):
    core.add_car(conn, "NO PRICE", scheme=core.MARGIN, sale_date=date(2026, 7, 1), sale_price=1200)
    core.add_car(conn, "BACKWARD", scheme=core.MARGIN, purchase_date=date(2026, 9, 1), purchase_price=100,
                 sale_date=date(2026, 8, 1), sale_price=200)
    core.add_transaction(conn, date(2026, 7, 9), "Fuel", "-60", core.EXPENSE_VAT)
    core.add_transaction(conn, date(2026, 7, 10), "Mystery", "-10")
    text = "\n".join(core.calculate_return(conn, Q3).warnings)
    assert "1 transaction in this quarter still uncategorised" in text
    assert "VAT reclaimed with no receipt" in text
    assert "NO PRICE: sold with no purchase price" in text
    assert "BACKWARD: sale date 01/08/2026 is before its purchase date 01/09/2026" in text


def test_receipt_clears_warning_and_exports(conn, tmp_path):
    tid = core.add_transaction(conn, date(2026, 7, 9), "Fuel", "-60", core.EXPENSE_VAT)
    path = core.add_receipt(conn, tid, "fuel receipt.pdf", b"%PDF-1.4 test")
    assert path.parent == tmp_path / "receipts" / str(tid)
    assert not any("no receipt" in w for w in core.calculate_return(conn, Q3).warnings)
    assert core.get_transactions_df(conn, Q3)["receipts"].iloc[0] == 1
    assert core.receipts_zip(conn, Q3)
    csv_text = core.export_quarter_csv(conn, Q3).decode("utf-8-sig")
    assert "VAT boxes" in csv_text and "Fuel" in csv_text


def test_quarters_for_march_stagger_in_october_2026():
    qs = core.recent_quarters("MAR", today=date(2026, 10, 25))
    assert len(qs) == 8
    assert qs[0] == core.Quarter(date(2026, 10, 1), date(2026, 12, 31))
    assert qs[0].label == "Oct-Dec 2026"
    assert qs[1].label == "Jul-Sep 2026"
    assert qs[-1].label == "Jan-Mar 2025"


def test_quarters_respect_registration_date_and_other_staggers():
    qs = core.recent_quarters("MAR", today=date(2026, 10, 25), reg_date=date(2026, 5, 15))
    assert [q.label for q in qs] == ["Oct-Dec 2026", "Jul-Sep 2026", "Apr-Jun 2026"]
    assert core.quarter_for(date(2026, 10, 25), "JAN").label == "Aug-Oct 2026"
    assert core.quarter_for(date(2026, 12, 5), "FEB").label == "Dec 2026-Feb 2027"


def test_filing_deadline_is_one_month_and_seven_days():
    assert core.filing_deadline(Q3) == date(2026, 11, 7)
    assert core.filing_deadline(core.quarter_for(date(2026, 11, 1), "MAR")) == date(2027, 2, 7)
    assert core.filing_deadline(core.quarter_for(date(2026, 1, 1), "JAN")) == date(2026, 3, 7)


def test_quarter_progress(conn):
    import_bank(conn)
    core.add_transaction(conn, date(2026, 7, 10), "Mystery", "-10")
    p = core.quarter_progress(conn, Q3)
    assert (p.total, p.categorised, p.receipts_needed, p.receipts_attached) == (7, 6, 2, 0)
    assert (p.money_in, p.money_out) == (Decimal("1120.00"), Decimal("1110.00"))


def test_save_filtered_stock_view_keeps_hidden_cars(conn):
    seed_cars(conn)
    cars = core.get_cars_df(conn)
    in_stock = cars[cars["sale_date"].isna()]
    assert core.save_cars(conn, in_stock, shown_ids=set(in_stock["id"])) == 1
    assert len(core.get_cars_df(conn)) == 4
    core.save_cars(conn, in_stock.iloc[0:0], shown_ids=set(in_stock["id"]))  # row deleted in view
    assert sorted(core.get_cars_df(conn)["reg"]) == ["AB12 CDE", "CD34 EFG", "GH78 IJK"]


def test_missing_purchase_details_are_warned(conn):
    core.add_car(conn, "NOPRICE", scheme=core.MARGIN, purchase_date=date(2026, 7, 1))
    core.add_car(conn, "NOVAT", scheme=core.STANDARD, purchase_date=date(2026, 7, 2), purchase_price=9000)
    core.add_transaction(conn, date(2026, 7, 3), "Parts", "-50", core.EXPENSE_NO_VAT, vat="8.33")
    r = core.calculate_return(conn, Q3)
    text = "\n".join(r.warnings)
    assert "NOPRICE: bought 01/07/2026 with no purchase price" in text
    assert "NOVAT: Standard car with no purchase VAT entered" in text
    assert "£8.33 VAT entered on a 'Expense - no VAT' line is ignored" in text
    assert r.box_str(4) == "0.00"


def test_car_payments_match_stock_book(conn):
    seed_cars(conn)
    raw = pd.DataFrame([
        ["22/07/2026", "Faster payment J Bloggs", "4500.00", ""],     # AB12 CDE sold 20/07
        ["03/08/2026", "Auction house", "", "5000.00"],              # CD34 EFG bought 01/08
        ["30/09/2026", "Customer", "4800.00", ""],                   # 29 days after sale: no match
    ], columns=["Date", "Description", "Paid in", "Paid out"])
    res = core.import_transactions(conn, raw, core.detect_columns(list(raw.columns)))
    assert res.cars_matched == 2
    cats = core.get_transactions_df(conn, Q3)["category"].tolist()
    assert cats == [core.CAR_SALE, core.CAR_PURCHASE, core.UNCATEGORISED]
    rec = core.car_reconciliation(conn, Q3)
    assert [c["reg"] for c in rec["sold_unpaid"]] == ["CD34 EFG", "GH78 IJK"]
    assert [c["reg"] for c in rec["bought_unpaid"]] == ["EF56 GHI", "GH78 IJK"]
    assert core.calculate_return(conn, Q3).box_str(1) == "2650.00"  # car lines don't double-count


def test_category_learned_from_same_payee(conn):
    tid = core.add_transaction(conn, date(2026, 7, 1), "CARD 1234 SHELL LEEDS 01JUL", "-40")
    df = core.get_transactions_df(conn, Q3)
    df.loc[df.id == tid, "category"] = core.EXPENSE_VAT
    core.update_transactions(conn, df)
    raw = pd.DataFrame([["15/08/2026", "CARD 9876 SHELL LEEDS 15AUG", "-55.20"]],
                       columns=["Date", "Description", "Amount"])
    res = core.import_transactions(conn, raw, core.detect_columns(list(raw.columns)))
    assert res.categorised == 1
    last = core.get_transactions_df(conn, Q3).iloc[-1]
    assert (last["category"], last["vat"]) == (core.EXPENSE_VAT, 9.2)


def test_starter_rules_and_auto_categorise(conn):
    core.add_transaction(conn, date(2026, 7, 1), "HMRC VAT PAYMENT", "-500")
    core.add_transaction(conn, date(2026, 7, 2), "ESSO GARAGE", "-30")
    assert core.add_rules(conn, core.STARTER_RULES) == len(core.STARTER_RULES)
    assert core.add_rules(conn, core.STARTER_RULES) == 0  # no duplicates
    assert core.auto_categorise(conn) == 2
    assert core.get_transactions_df(conn, Q3)["category"].tolist() == [core.EXCLUDE, core.EXPENSE_VAT]


def test_record_sale_and_preview(conn):
    cid = core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 7, 1), 3000)
    assert core.sale_figures(core.MARGIN, Decimal("3000"), None, Decimal("4500")) == \
        (Decimal("250.00"), Decimal("1500"), Decimal("1250.00"))
    assert core.sale_figures(core.STANDARD, Decimal("12000"), Decimal("2000"), Decimal("14400")) == \
        (Decimal("2400.00"), None, Decimal("2000.00"))
    core.record_sale(conn, cid, date(2026, 8, 1), 4500)
    assert core.calculate_return(conn, Q3).box_str(1) == "250.00"


def test_filed_quarter_detects_later_changes(conn):
    seed_cars(conn)
    core.mark_filed(conn, Q3, date(2026, 10, 20))
    r = core.calculate_return(conn, Q3)
    assert r.filed_on == date(2026, 10, 20) and not any("Filed on" in w for w in r.warnings)
    core.add_transaction(conn, date(2026, 9, 30), "Late invoice", "-120", core.EXPENSE_VAT)
    warning = core.calculate_return(conn, Q3).warnings[0]
    assert warning.startswith("Filed on 20/10/2026") and "Box 4 2000.00 → 2020.00" in warning
    core.unmark_filed(conn, Q3)
    assert core.calculate_return(conn, Q3).filed_on is None


def test_backup_contains_db_and_receipts(conn):
    import io
    import zipfile
    tid = core.add_transaction(conn, date(2026, 7, 9), "Fuel", "-60", core.EXPENSE_VAT)
    core.add_receipt(conn, tid, "fuel.pdf", b"%PDF")
    names = zipfile.ZipFile(io.BytesIO(core.backup_zip(conn))).namelist()
    assert names == ["vat.db", f"receipts/{tid}/fuel.pdf"]


def test_part_exchange_sale(conn):
    sold_id = core.add_car(conn, "AB12 CDE", "Ford Focus", core.MARGIN, date(2026, 7, 1), 3000)
    px_id = core.record_sale(conn, sold_id, date(2026, 8, 10), 9000, px_allowance=2000,
                             px_reg="px11 aaa", px_make_model="Vauxhall Corsa")
    px = next(c for c in core.list_cars(conn) if c["id"] == px_id)
    assert (px["reg"], px["scheme"], px["purchase_date"], px["purchase_price"], px["px_for"]) == \
        ("PX11 AAA", core.MARGIN, date(2026, 8, 10), Decimal("2000.00"), sold_id)

    r = core.calculate_return(conn, Q3)
    # Margin on the full 9000 (cash + part-ex): 6000 / 6 = 1000. Part-ex car is a 2000 input.
    assert (r.box_str(1), r.box_str(6), r.box_str(7)) == ("1000.00", "8000", "5000")
    assert r.cars_sold[0]["px_allowance"] == Decimal("2000.00")

    raw = pd.DataFrame([["11/08/2026", "Customer", "7000.00"]], columns=["Date", "Description", "Amount"])
    assert core.import_transactions(conn, raw, core.detect_columns(list(raw.columns))).cars_matched == 1
    rec = core.car_reconciliation(conn, Q3)
    assert rec["sold_unpaid"] == [] and [c["reg"] for c in rec["bought_unpaid"]] == ["AB12 CDE"]
    assert "Part-ex allowance" in core.export_quarter_csv(conn, Q3).decode("utf-8-sig")


def test_read_bank_csv_with_preamble_and_semicolons():
    data = ("Tide Business Account;;;\r\nAccount 12345678;;;\r\n\r\n"
            "Date;Description;Paid in;Paid out\r\n"
            "02/07/2026;Valeting;120,00;\r\n;;;\r\n03/07/2026;Shell;;60.00\r\n").encode("cp1252")
    df = core.read_bank_csv(data)
    assert list(df.columns) == ["Date", "Description", "Paid in", "Paid out"]
    assert df["Description"].tolist() == ["Valeting", "Shell"]
    assert [core.dec(v) for v in ("120,00", "1.234,56", "1,234.56", "1,000", "£(12.50)")] == \
        [Decimal("120.00"), Decimal("1234.56"), Decimal("1234.56"), Decimal("1000"), Decimal("-12.50")]

    bom = "﻿Date,Description,Amount\n05/07/2026,Fee,-5.00\nTotal,,-5.00\n".encode("utf-8")
    df = core.read_bank_csv(bom)
    assert list(df.columns) == ["Date", "Description", "Amount"]


def test_unreadable_rows_are_reported_with_preview(conn):
    raw = pd.DataFrame([["05/07/2026", "Fee", "-5.00"], ["Total", "", "-5.00"]],
                       columns=["Date", "Description", "Amount"])
    res = core.import_transactions(conn, raw, core.detect_columns(list(raw.columns)))
    assert res.added == 1 and res.failed == ["Row 2 (Total | -5.00): Not a valid date: 'Total'"]


def test_vrn_checksum():
    assert core.vrn_checksum_ok("123456782")          # mod 97
    assert core.vrn_checksum_ok("GB 123 4567 82")     # prefix and spaces stripped
    assert core.vrn_checksum_ok("123456727")          # mod 9755
    assert not core.vrn_checksum_ok("123456789")
    assert not core.vrn_checksum_ok("12345678")
    assert core.format_vrn("gb123456782") == "GB 123 4567 82"
    assert core.vrn_checksum_ok("123456782001")       # branch code after a valid VRN
    assert not core.vrn_checksum_ok("123456789001")
    assert core.vrn_shape_ok("553557881") and not core.vrn_shape_ok("1234567820")
    assert core.format_vrn("123456782001") == "GB 123 4567 82 001"


def test_sandbox_not_found_explains_test_numbers(monkeypatch):
    class Resp:
        status_code = 404
    monkeypatch.setenv("HMRC_USE_SANDBOX", "true")
    monkeypatch.setattr(lookups, "_hmrc_token", lambda: "t")
    monkeypatch.setattr(lookups, "_get", lambda *a, **k: Resp())
    with pytest.raises(lookups.LookupFailed, match="test service"):
        lookups.hmrc_check_vat_number("123456782")
    monkeypatch.setenv("HMRC_USE_SANDBOX", "false")
    with pytest.raises(lookups.LookupFailed, match="not registered with HMRC"):
        lookups.hmrc_check_vat_number("123456782")


# ---------------------------------------------------------------- lookups (no live calls)

@pytest.fixture
def no_network(monkeypatch):
    def fail(*a, **k):
        raise AssertionError("live HTTP call attempted")
    monkeypatch.setattr(lookups.requests, "get", fail)
    monkeypatch.setattr(lookups.requests, "post", fail)
    lookups._token_cache.clear()


def test_lookups_without_keys(monkeypatch, no_network):
    for k in ("COMPANIES_HOUSE_API_KEY", "HMRC_CLIENT_ID", "HMRC_CLIENT_SECRET"):
        monkeypatch.delenv(k, raising=False)
    assert not lookups.companies_house_available()
    assert not lookups.hmrc_available()
    with pytest.raises(lookups.LookupFailed, match="No Companies House API key"):
        lookups.companies_house_lookup("01234567")
    with pytest.raises(lookups.LookupFailed, match="No HMRC credentials"):
        lookups.hmrc_check_vat_number("123456782")


class FakeResp:
    def __init__(self, status, body=None):
        self.status_code, self._body, self.text = status, body or {}, str(body or "")

    def json(self):
        return self._body


@pytest.mark.parametrize("status, message", [
    (401, "rejected the credentials"), (404, "not found"), (429, "rate limit"), (500, "HTTP 500")])
def test_companies_house_http_errors(monkeypatch, status, message):
    monkeypatch.setenv("COMPANIES_HOUSE_API_KEY", "secret-key-123")
    monkeypatch.setattr(lookups.requests, "get", lambda *a, **k: FakeResp(status))
    with pytest.raises(lookups.LookupFailed, match=message) as e:
        lookups.companies_house_lookup("1234567")
    assert "secret-key-123" not in str(e.value)


def test_companies_house_network_error(monkeypatch):
    monkeypatch.setenv("COMPANIES_HOUSE_API_KEY", "k")

    def boom(*a, **k):
        raise requests.ConnectionError("down")
    monkeypatch.setattr(lookups.requests, "get", boom)
    with pytest.raises(lookups.LookupFailed, match="Couldn't reach Companies House"):
        lookups.companies_house_lookup("01234567")


def test_companies_house_success(monkeypatch):
    monkeypatch.setenv("COMPANIES_HOUSE_API_KEY", "k")
    profile = {"company_name": "TEST MOTORS LTD", "company_status": "active", "sic_codes": ["45112"],
               "date_of_creation": "2019-03-01",
               "registered_office_address": {"address_line_1": "1 High St", "locality": "Leeds",
                                             "postal_code": "LS1 1AA"}}
    officers = {"items": [{"name": "SMITH, John", "officer_role": "director"},
                          {"name": "OLD, Pat", "officer_role": "director", "resigned_on": "2021-01-01"},
                          {"name": "SEC, Co", "officer_role": "secretary"}]}
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs["auth"]))
        return FakeResp(200, officers if url.endswith("/officers") else profile)
    monkeypatch.setattr(lookups.requests, "get", fake_get)
    data = lookups.companies_house_lookup("1234567")
    assert data["company_number"] == "01234567"
    assert data["registered_office"] == "1 High St, Leeds, LS1 1AA"
    assert data["directors"] == "SMITH, John"
    assert calls[0] == (f"{lookups.CH_BASE}/company/01234567", ("k", ""))


def test_hmrc_lookup(monkeypatch):
    monkeypatch.setenv("HMRC_CLIENT_ID", "id")
    monkeypatch.setenv("HMRC_CLIENT_SECRET", "shh")
    monkeypatch.setenv("HMRC_USE_SANDBOX", "true")
    lookups._token_cache.clear()
    monkeypatch.setattr(lookups.requests, "post",
                        lambda url, **k: FakeResp(200, {"access_token": "tok", "expires_in": 14400}))
    seen = {}

    def fake_get(url, headers, **k):
        seen.update(url=url, headers=headers)
        return FakeResp(200, {"target": {"name": "Test Motors Ltd", "vatNumber": "123456782",
                                         "address": {"line1": "1 High St", "postcode": "LS1 1AA"}}})
    monkeypatch.setattr(lookups.requests, "get", fake_get)
    data = lookups.hmrc_check_vat_number("GB123456782")
    assert data == {"vrn": "123456782", "name": "Test Motors Ltd", "address": "1 High St, LS1 1AA"}
    assert seen["url"].startswith(lookups.HMRC_SANDBOX)
    assert seen["headers"]["Accept"] == "application/vnd.hmrc.2.0+json"
    assert lookups.names_match("TEST MOTORS LIMITED", "Test Motors Ltd")


def test_hmrc_bad_credentials(monkeypatch):
    monkeypatch.setenv("HMRC_CLIENT_ID", "id")
    monkeypatch.setenv("HMRC_CLIENT_SECRET", "topsecret")
    lookups._token_cache.clear()
    monkeypatch.setattr(lookups.requests, "post", lambda url, **k: FakeResp(401, {"error": "invalid_client"}))
    with pytest.raises(lookups.LookupFailed, match="rejected the client ID") as e:
        lookups.hmrc_check_vat_number("123456782")
    assert "topsecret" not in str(e.value)
