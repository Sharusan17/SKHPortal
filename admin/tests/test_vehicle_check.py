"""Reg lookup (DVLA + DVSA MOT history, mocked) and the reminders list."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

import core
import lookups
import server
from test_invoices import BUSINESS, invoice

TODAY = date(2026, 11, 8)
DVLA = {"registrationNumber": "KX19ABC", "make": "AUDI", "colour": "GREY", "fuelType": "PETROL",
        "engineCapacity": 1498, "yearOfManufacture": 2019, "monthOfFirstRegistration": "2019-05",
        "taxStatus": "Taxed", "taxDueDate": "2026-11-20", "motStatus": "Valid", "motExpiryDate": "2027-05-10"}
MOT = {"registration": "KX19ABC", "make": "AUDI", "model": "A3", "firstUsedDate": "2019-05-14",
       "primaryColour": "Grey", "fuelType": "Petrol", "motTests": [
           {"completedDate": "2022-05-10T10:00:00.000Z", "testResult": "PASSED", "expiryDate": "2023-05-09",
            "odometerValue": "30500", "odometerUnit": "MI"},
           {"completedDate": "2023-05-11T10:00:00.000Z", "testResult": "PASSED", "expiryDate": "2024-05-10",
            "odometerValue": "41200", "odometerUnit": "MI"},
           {"completedDate": "2024-05-09T10:00:00.000Z", "testResult": "PASSED", "expiryDate": "2025-05-08",
            "odometerValue": "36100", "odometerUnit": "MI"}]}


class Resp:
    def __init__(self, status, body=None):
        self.status_code, self._body = status, body or {}

    def json(self):
        return self._body


@pytest.fixture
def keys(monkeypatch):
    for k, v in {"DVLA_API_KEY": "d", "MOT_CLIENT_ID": "c", "MOT_CLIENT_SECRET": "s", "MOT_API_KEY": "m",
                 "MOT_TOKEN_URL": "https://login.example/token"}.items():
        monkeypatch.setenv(k, v)
    lookups._token_cache.clear()
    calls = []

    def post(url, **kw):
        calls.append(url)
        if "token" in url:
            return Resp(200, {"access_token": "t", "expires_in": 3600})
        return Resp(200 if kw["json"]["registrationNumber"] == "KX19ABC" else 404, DVLA)

    def get(url, **kw):
        calls.append(url)
        assert kw["headers"]["X-API-Key"] == "m" and kw["headers"]["Authorization"] == "Bearer t"
        return Resp(200, MOT) if url.endswith("KX19ABC") else Resp(404)

    monkeypatch.setattr(lookups.requests, "post", post)
    monkeypatch.setattr(lookups.requests, "get", get)
    return calls


def test_lookup_combines_dvla_and_mot(keys):
    r = lookups.vehicle_lookup("kx19 abc")
    assert (r["make_model"], r["colour"], r["fuel"], r["first_reg"]) == ("Audi A3", "Grey", "Petrol", "2019-05-14")
    assert (r["tax_due"], r["mot_expiry"], r["last_mot_miles"]) == ("2026-11-20", "2027-05-10", 36100)
    assert r["mileage_warnings"] == ["Mileage went down from 41,200 (2023-05-11) to 36,100 (2024-05-09)."]
    assert [t["miles"] for t in r["mileage_history"]] == [30500, 41200, 36100]


def test_lookup_errors(keys, monkeypatch):
    with pytest.raises(lookups.LookupFailed, match="no vehicle registered|No MOT history"):
        lookups.vehicle_lookup("ZZ99 ZZZ")
    monkeypatch.delenv("MOT_API_KEY")
    r = lookups.vehicle_lookup("KX19ABC")  # DVLA alone still works
    assert r["make_model"] == "Audi" and r["mileage_history"] == []
    monkeypatch.delenv("DVLA_API_KEY")
    with pytest.raises(lookups.LookupFailed, match="isn't set up"):
        lookups.vehicle_lookup("KX19ABC")


def test_km_readings_converted():
    assert lookups.mileage_warnings([{"date": "a", "miles": 100}, {"date": "b", "miles": 90}])
    assert not lookups.mileage_warnings([{"date": "a", "miles": None}, {"date": "b", "miles": 90}])


def test_check_saves_on_car_without_overwriting(keys, tmp_path):
    conn = core.connect(tmp_path / "v.db")
    car = core.add_car(conn, "KX19 ABC", "", core.MARGIN, date(2026, 10, 12), 11000, colour="White")
    core.apply_vehicle_check(conn, car, lookups.vehicle_lookup("KX19ABC"))
    c = core.car_overview(conn, TODAY)[0]
    assert c["make_model"] == "Audi A3" and c["colour"] == "White"  # filled blank, kept typed
    assert c["tax_due"] == date(2026, 11, 20) and c["mot_expiry"] == date(2027, 5, 10)
    assert c["mileage"] == "36100" and len(c["mileage_history"]) == 3


def test_reminders(tmp_path):
    conn = core.connect(tmp_path / "v.db")
    core.save_business(conn, BUSINESS)  # MAR stagger: Jul-Sep 2026 due 7 Nov 2026
    a = core.add_car(conn, "AA11 AAA", "Car A", core.MARGIN, date(2026, 10, 1), 3000)
    conn.execute("UPDATE cars SET tax_due = '2026-11-20', mot_expiry = '2026-11-01' WHERE id = ?", (a,))
    b = core.add_car(conn, "BB22 BBB", "Car B", core.MARGIN, date(2026, 9, 1), 3000)
    core.create_invoice(conn, invoice(b, 5000, "2026-10-01"))
    texts = [(r["level"], r["text"]) for r in core.reminders(conn, TODAY)]
    assert texts[0] == ("overdue", "VAT return for Jul-Sep 2026 was due 07 Nov 2026")
    assert ("overdue", "AA11 AAA: MOT expired 01 Nov 2026") in texts
    assert ("soon", "AA11 AAA: Road tax runs out 20 Nov 2026 (12 days)") in texts
    assert ("soon", "AA11 AAA: purchase bill not marked paid") in texts
    assert any(level == "overdue" and "Invoice 0001 (BB22 BBB)" in t for level, t in texts)
    core.mark_filed(conn, core.quarter_for(date(2026, 8, 1), "MAR"), date(2026, 11, 1))
    assert not any(r["kind"] == "vat" for r in core.reminders(conn, TODAY))


def test_endpoints(keys, tmp_path):
    client = TestClient(server.create_app(str(tmp_path / "v.db")))
    client.put("/api/business", json={**BUSINESS, "vrn": "123456782"}).raise_for_status()
    assert client.get("/api/meta").json()["lookups"]["dvla"] is True
    assert client.get("/api/vehicle-lookup", params={"reg": "KX19ABC"}).json()["make_model"] == "Audi A3"
    assert client.get("/api/vehicle-lookup", params={"reg": "ZZ99ZZZ"}).status_code == 400
    client.post("/api/cars", json={"reg": "KX19ABC", "purchase_date": "2026-10-12", "purchase_price": 11000})
    car = client.get("/api/stock").json()[0]
    r = client.post(f"/api/cars/{car['id']}/check").json()
    assert r["warnings"] and "checked" in r["message"]
    assert client.get("/api/stock").json()[0]["tax_due"] == "2026-11-20"
    assert isinstance(client.get("/api/reminders").json(), list)
