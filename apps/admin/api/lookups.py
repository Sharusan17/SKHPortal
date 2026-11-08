"""Companies House and HMRC lookups. Keys come from the environment and are never logged."""
from __future__ import annotations

import os
import re
import time

import requests

CH_BASE = "https://api.company-information.service.gov.uk"
HMRC_LIVE = "https://api.service.hmrc.gov.uk"
HMRC_SANDBOX = "https://test-api.service.hmrc.gov.uk"
TIMEOUT = 15

_token_cache: dict[str, tuple[str, float]] = {}


class LookupFailed(Exception):
    """A lookup failed; the message is safe to show to the user."""


def companies_house_available() -> bool:
    return bool(os.environ.get("COMPANIES_HOUSE_API_KEY", "").strip())


def hmrc_available() -> bool:
    return bool(os.environ.get("HMRC_CLIENT_ID", "").strip()
                and os.environ.get("HMRC_CLIENT_SECRET", "").strip())


def hmrc_sandbox() -> bool:
    return os.environ.get("HMRC_USE_SANDBOX", "").strip().lower() == "true"


def hmrc_base() -> str:
    return HMRC_SANDBOX if hmrc_sandbox() else HMRC_LIVE


def normalise_company_number(raw: str) -> str:
    s = re.sub(r"\s", "", str(raw or "")).upper()
    return s.zfill(8) if s.isdigit() else s


def _get(url: str, service: str, **kwargs) -> requests.Response:
    try:
        return requests.get(url, timeout=TIMEOUT, **kwargs)
    except requests.RequestException:
        raise LookupFailed(f"Couldn't reach {service}. Check your internet connection.") from None


def _raise_for(resp: requests.Response, service: str, not_found: str, key_hint: str) -> None:
    if resp.status_code == 200:
        return
    if resp.status_code == 401:
        raise LookupFailed(f"{service} rejected the credentials (401). Check {key_hint} in .env.")
    if resp.status_code == 403:
        raise LookupFailed(f"{service} refused access (403). Check the application is subscribed "
                           "to this API.")
    if resp.status_code == 404:
        raise LookupFailed(not_found)
    if resp.status_code == 429:
        raise LookupFailed(f"{service} rate limit reached (429). Wait a few minutes and try again.")
    raise LookupFailed(f"{service} returned an error (HTTP {resp.status_code}).")


# ---------------------------------------------------------------- Companies House

def companies_house_lookup(company_number: str) -> dict:
    key = os.environ.get("COMPANIES_HOUSE_API_KEY", "").strip()
    if not key:
        raise LookupFailed("No Companies House API key set. Add COMPANIES_HOUSE_API_KEY to .env "
                           "or enter the details manually.")
    number = normalise_company_number(company_number)
    if not re.fullmatch(r"[A-Z0-9]{8}", number):
        raise LookupFailed("Company number should be 8 characters, e.g. 01234567 or SC123456.")
    hint = "COMPANIES_HOUSE_API_KEY"
    auth = (key, "")

    resp = _get(f"{CH_BASE}/company/{number}", "Companies House", auth=auth)
    _raise_for(resp, "Companies House", f"Company {number} not found at Companies House.", hint)
    profile = resp.json()

    resp = _get(f"{CH_BASE}/company/{number}/officers", "Companies House", auth=auth,
                params={"items_per_page": 100})
    _raise_for(resp, "Companies House", f"No officers found for company {number}.", hint)
    officers = resp.json().get("items", [])

    addr = profile.get("registered_office_address", {})
    address = ", ".join(addr[k] for k in ("premises", "address_line_1", "address_line_2", "locality",
                                           "region", "postal_code", "country") if addr.get(k))
    directors = [o["name"] for o in officers
                 if "director" in o.get("officer_role", "") and not o.get("resigned_on") and o.get("name")]
    ard = (profile.get("accounts") or {}).get("accounting_reference_date") or {}
    try:
        year_end = f"{int(ard['month']):02d}-{int(ard['day']):02d}"
    except (KeyError, TypeError, ValueError):
        year_end = ""
    return {
        "year_end": year_end,
        "company_number": number,
        "company_name": profile.get("company_name", ""),
        "company_status": profile.get("company_status", ""),
        "registered_office": address,
        "sic_codes": ", ".join(profile.get("sic_codes", [])),
        "incorporation_date": profile.get("date_of_creation", ""),
        "directors": "\n".join(directors),
    }


# ---------------------------------------------------------------- HMRC

def _hmrc_token() -> str:
    client_id = os.environ.get("HMRC_CLIENT_ID", "").strip()
    secret = os.environ.get("HMRC_CLIENT_SECRET", "").strip()
    if not (client_id and secret):
        raise LookupFailed("No HMRC credentials set. Add HMRC_CLIENT_ID and HMRC_CLIENT_SECRET to .env.")
    base = hmrc_base()
    cached = _token_cache.get(base)
    if cached and cached[1] > time.time() + 60:
        return cached[0]

    data = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret,
            "scope": "read:vat"}
    try:
        resp = requests.post(f"{base}/oauth/token", data=data, timeout=TIMEOUT)
        if resp.status_code == 400 and "invalid_scope" in resp.text:
            # Check-a-VAT-number is application-restricted and may not grant read:vat.
            data.pop("scope")
            resp = requests.post(f"{base}/oauth/token", data=data, timeout=TIMEOUT)
    except requests.RequestException:
        raise LookupFailed("Couldn't reach HMRC. Check your internet connection.") from None
    if resp.status_code in (400, 401):
        raise LookupFailed("HMRC rejected the client ID or secret. Check HMRC_CLIENT_ID, "
                           "HMRC_CLIENT_SECRET and HMRC_USE_SANDBOX in .env.")
    _raise_for(resp, "HMRC", "HMRC token endpoint not found.", "HMRC_CLIENT_ID / HMRC_CLIENT_SECRET")
    body = resp.json()
    _token_cache[base] = (body["access_token"], time.time() + int(body.get("expires_in", 3600)))
    return body["access_token"]


def hmrc_check_vat_number(vrn: str) -> dict:
    vrn = re.sub(r"[\s\-]", "", str(vrn or "")).upper().removeprefix("GB")
    if not re.fullmatch(r"\d{9}|\d{12}", vrn):
        raise LookupFailed("VAT number should be 9 digits (or 12 with a branch code).")
    token = _hmrc_token()
    resp = _get(f"{hmrc_base()}/organisations/vat/check-vat-number/lookup/{vrn}", "HMRC",
                headers={"Accept": "application/vnd.hmrc.2.0+json", "Authorization": f"Bearer {token}"})
    if resp.status_code == 401:
        _token_cache.pop(hmrc_base(), None)
    not_found = f"VAT number {vrn} is not registered with HMRC."
    if hmrc_sandbox():
        # The sandbox only holds HMRC's made-up test numbers, so every real VRN is "not found".
        not_found = (f"HMRC's test service doesn't know {vrn}: it only holds test numbers such as "
                     "553557881. Real VAT numbers can be checked once production credentials are in "
                     ".env with HMRC_USE_SANDBOX=false. You can still save a number that passes the "
                     "check-digit test.")
    _raise_for(resp, "HMRC", not_found, "HMRC_CLIENT_ID / HMRC_CLIENT_SECRET")
    target = resp.json().get("target", {})
    addr = target.get("address", {})
    address = ", ".join(addr[k] for k in ("line1", "line2", "line3", "line4", "line5", "postcode")
                        if addr.get(k))
    return {"vrn": target.get("vatNumber", vrn), "name": target.get("name", ""), "address": address}


def names_match(a: str, b: str) -> bool:
    def norm(s: str) -> str:
        s = re.sub(r"[^A-Z0-9 ]", "", (s or "").upper())
        s = re.sub(r"\bLIMITED\b", "LTD", s)
        return re.sub(r"\s+", " ", s).strip()
    return norm(a) == norm(b)


# ---------------------------------------------------------------- DVLA and DVSA (vehicles)

DVLA_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
MOT_BASE = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration"
MOT_DEFAULT_SCOPE = "https://tapi.dvsa.gov.uk/.default"


def normalise_reg(raw: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(raw or "").upper())


def dvla_available() -> bool:
    return bool(os.environ.get("DVLA_API_KEY", "").strip())


def mot_available() -> bool:
    return all(os.environ.get(k, "").strip() for k in ("MOT_CLIENT_ID", "MOT_CLIENT_SECRET", "MOT_API_KEY",
                                                      "MOT_TOKEN_URL"))


def dvla_lookup(reg: str) -> dict:
    """DVLA Vehicle Enquiry Service: make, colour, fuel, engine, tax and MOT status."""
    key = os.environ.get("DVLA_API_KEY", "").strip()
    if not key:
        raise LookupFailed("No DVLA key set. Add DVLA_API_KEY to .env.")
    vrm = normalise_reg(reg)
    if not 2 <= len(vrm) <= 8:
        raise LookupFailed("Enter a UK registration, e.g. KX19 ABC.")
    try:
        resp = requests.post(DVLA_URL, json={"registrationNumber": vrm}, timeout=TIMEOUT,
                             headers={"x-api-key": key, "Accept": "application/json"})
    except requests.RequestException:
        raise LookupFailed("Couldn't reach the DVLA. Check your internet connection.") from None
    if resp.status_code == 400:
        raise LookupFailed(f"The DVLA didn't accept {vrm} as a registration.")
    _raise_for(resp, "DVLA", f"The DVLA has no vehicle registered as {vrm}.", "DVLA_API_KEY")
    d = resp.json()
    month = d.get("monthOfFirstRegistration")  # "2019-09"
    return {"reg": d.get("registrationNumber", vrm), "make": d.get("make", ""), "colour": d.get("colour", ""),
            "fuel": d.get("fuelType", ""), "engine_cc": d.get("engineCapacity"),
            "year": d.get("yearOfManufacture"), "first_reg_month": month,
            "tax_status": d.get("taxStatus", ""), "tax_due": d.get("taxDueDate"),
            "mot_status": d.get("motStatus", ""), "mot_expiry": d.get("motExpiryDate")}


def _mot_token() -> str:
    url = os.environ["MOT_TOKEN_URL"].strip()
    cached = _token_cache.get(url)
    if cached and cached[1] > time.time() + 60:
        return cached[0]
    try:
        resp = requests.post(url, timeout=TIMEOUT, data={
            "grant_type": "client_credentials", "client_id": os.environ["MOT_CLIENT_ID"].strip(),
            "client_secret": os.environ["MOT_CLIENT_SECRET"].strip(),
            "scope": os.environ.get("MOT_SCOPE", "").strip() or MOT_DEFAULT_SCOPE})
    except requests.RequestException:
        raise LookupFailed("Couldn't reach the DVSA sign-in service. Check your internet connection.") from None
    if resp.status_code != 200:
        raise LookupFailed("DVSA rejected the MOT history credentials. Check MOT_CLIENT_ID, "
                           "MOT_CLIENT_SECRET and MOT_TOKEN_URL in .env.")
    body = resp.json()
    _token_cache[url] = (body["access_token"], time.time() + int(body.get("expires_in", 3600)))
    return body["access_token"]


def mot_history(reg: str) -> dict:
    """DVSA MOT history: model, first use, and the mileage recorded at every test."""
    if not mot_available():
        raise LookupFailed("MOT history isn't set up. Add the DVSA MOT_* keys to .env.")
    vrm = normalise_reg(reg)
    resp = _get(f"{MOT_BASE}/{vrm}", "DVSA", headers={
        "Authorization": f"Bearer {_mot_token()}", "X-API-Key": os.environ["MOT_API_KEY"].strip(),
        "Accept": "application/json"})
    if resp.status_code == 401:
        _token_cache.pop(os.environ["MOT_TOKEN_URL"].strip(), None)
    _raise_for(resp, "DVSA", f"No MOT history found for {vrm}.", "MOT_API_KEY")
    d = resp.json()
    tests = []
    for t in d.get("motTests") or []:
        miles = t.get("odometerValue")
        unit = (t.get("odometerUnit") or "MI").upper()
        try:
            miles = int(miles)
            if unit.startswith("K"):
                miles = round(miles * 0.621371)
        except (TypeError, ValueError):
            miles = None
        tests.append({"date": (t.get("completedDate") or "")[:10], "result": t.get("testResult", ""),
                      "miles": miles, "expiry": t.get("expiryDate")})
    tests.sort(key=lambda t: t["date"])
    return {"model": d.get("model", ""), "make": d.get("make", ""),
            "first_used": d.get("firstUsedDate") or d.get("registrationDate"),
            "colour": d.get("primaryColour", ""), "fuel": d.get("fuelType", ""), "tests": tests,
            "recall": d.get("hasOutstandingRecall")}


def mileage_warnings(tests: list[dict]) -> list[str]:
    """Readings that go backwards between MOTs: a sign the mileage may have been altered."""
    out, last = [], None
    for t in tests:
        if t.get("miles") is None:
            continue
        if last and t["miles"] < last["miles"]:
            out.append(f"Mileage went down from {last['miles']:,} ({last['date']}) to "
                       f"{t['miles']:,} ({t['date']}).")
        last = t
    return out


def vehicle_lookup(reg: str) -> dict:
    """Everything both services know about a reg. Either may be missing; their errors are listed."""
    vrm = normalise_reg(reg)
    if not (dvla_available() or mot_available()):
        raise LookupFailed("Vehicle lookup isn't set up. Add DVLA_API_KEY (and the DVSA MOT_* keys) to .env.")
    out = {"reg": vrm, "errors": []}
    if dvla_available():
        try:
            out["dvla"] = dvla_lookup(vrm)
        except LookupFailed as e:
            out["errors"].append(str(e))
    if mot_available():
        try:
            out["mot"] = mot_history(vrm)
        except LookupFailed as e:
            out["errors"].append(str(e))
    if "dvla" not in out and "mot" not in out:
        raise LookupFailed(" ".join(out["errors"]))
    dv, mo = out.get("dvla") or {}, out.get("mot") or {}
    first = mo.get("first_used") or (f"{dv['first_reg_month']}-01" if dv.get("first_reg_month") else None)
    make = (dv.get("make") or mo.get("make") or "").title()
    model = (mo.get("model") or "").title()
    tests = mo.get("tests") or []
    out.update({
        "make": make, "model": model, "make_model": " ".join(x for x in (make, model) if x),
        "colour": (dv.get("colour") or mo.get("colour") or "").title(), "fuel": (dv.get("fuel") or mo.get("fuel") or "").title(),
        "engine_cc": dv.get("engine_cc"), "first_reg": first,
        "tax_status": dv.get("tax_status"), "tax_due": dv.get("tax_due"),
        "mot_status": dv.get("mot_status"),
        "mot_expiry": dv.get("mot_expiry") or next((t["expiry"] for t in reversed(tests) if t.get("expiry")), None),
        "mileage_history": tests, "mileage_warnings": mileage_warnings(tests),
        "last_mot_miles": next((t["miles"] for t in reversed(tests) if t.get("miles") is not None), None),
    })
    return out
