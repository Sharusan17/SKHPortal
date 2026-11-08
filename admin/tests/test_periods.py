"""Period picker: quarters, calendar, tax and financial years, all time, and the per-quarter split."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

import core
import server
from test_core import Q3, import_bank, seed_cars
from test_invoices import BUSINESS

TODAY = date(2026, 11, 8)


@pytest.fixture
def conn(tmp_path):
    c = core.connect(tmp_path / "v.db")
    core.save_business(c, {**BUSINESS, "vat_reg_date": "2024-04-01", "year_end": "03-31"})
    seed_cars(c)
    import_bank(c)
    yield c
    c.close()


def test_options(conn):
    o = core.period_options(conn, TODAY)
    assert o["quarter"][0].label == "Oct-Dec 2026" and o["quarter"][-1].start >= date(2024, 4, 1)
    assert [p.label for p in o["year"]] == ["2026", "2025", "2024"]
    assert o["tax_year"][0].label == "2026/27 tax year"
    assert (o["tax_year"][0].start, o["tax_year"][0].end) == (date(2026, 4, 6), date(2027, 4, 5))
    fy = o["financial_year"][0]
    assert (fy.label, fy.start, fy.end) == ("Year to 31 Mar 2027", date(2026, 4, 1), date(2027, 3, 31))
    assert o["all"][0].start == date(2024, 4, 1) and o["all"][0].end == TODAY


def test_periods_start_from_the_quarter_the_business_began(conn):
    core.save_business(conn, {**BUSINESS, "vat_reg_date": "2024-04-01", "incorporation_date": "2026-02-10"})
    o = core.period_options(conn, TODAY)
    assert o["quarter"][-1].label == "Jan-Mar 2026"  # nothing before the quarter it began in
    assert [p.label for p in o["year"]] == ["2026"]
    assert o["all"][0].start == date(2026, 1, 1)


def test_no_financial_years_without_year_end(conn):
    core.save_business(conn, {**BUSINESS, "vat_reg_date": "2024-04-01"})
    assert core.period_options(conn, TODAY)["financial_year"] == []


def test_year_split_into_quarters(conn):
    s = core.period_summary(conn, core.period_by_id(conn, "y:2026", TODAY), TODAY)
    assert [q["label"] for q in s["quarters"]] == ["Jan-Mar 2026", "Apr-Jun 2026", "Jul-Sep 2026", "Oct-Dec 2026"]
    q3 = s["quarters"][2]
    assert q3["boxes"][1] == "2670.00" and q3["boxes"][5] == "610.00" and q3["cars_sold"] == 3
    assert s["totals"][1] == "2670.00" and s["totals"][7] == "25540"  # Q3 22540 + AB12 CDE bought in Q2
    assert s["sold"]["count"] == 3 and s["bank"]["lines"] == 6


def test_quarter_and_all_time(conn):
    q = core.period_by_id(conn, f"q:{Q3.start}", TODAY)
    assert core.period_summary(conn, q, TODAY)["totals"][5] == "610.00"
    everything = core.period_summary(conn, core.period_by_id(conn, "all", TODAY), TODAY)
    assert everything["sold"]["count"] == 3 and len(everything["quarters"]) >= 2
    with pytest.raises(ValueError):
        core.period_by_id(conn, "y:1999", TODAY)


def test_endpoints(tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "v.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782", "year_end": "03-31"}).raise_for_status()
    assert client.put("/api/business", json={**BUSINESS, "vrn": "123456782", "year_end": "31-03"}).status_code == 400
    p = client.get("/api/periods").json()
    assert set(p["kinds"]) == {"quarter", "year", "tax_year", "financial_year", "all"}
    year = p["options"]["year"][0]["id"]
    assert client.get("/api/period-summary", params={"p": year}).json()["period"]["kind"] == "year"
    assert client.get("/api/period-summary", params={"p": "nope"}).status_code == 400
    assert client.get("/api/transactions", params={"p": "all"}).json() == []
    assert client.get("/api/home", params={"p": year}).json()["sold"]["label"] == year[2:]
