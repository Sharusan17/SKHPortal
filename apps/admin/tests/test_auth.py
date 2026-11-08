"""Admin sign-in: nothing but signing in works without the session cookie."""
import pytest
from fastapi.testclient import TestClient

import auth
import server

PASSWORD = "correct horse battery staple"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "Owner@Example.com")
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", auth.hash_password(PASSWORD))
    monkeypatch.setenv("SESSION_SECRET", "x" * 40)
    return TestClient(server.build_app(str(tmp_path / "v.db")), base_url="https://testserver")


def login(c, email="owner@example.com", password=PASSWORD):
    return c.post("/admin/api/auth/login", json={"email": email, "password": password})


def test_password_hash():
    h = auth.hash_password(PASSWORD)
    assert PASSWORD not in h and auth.check_password(PASSWORD, h) and not auth.check_password("nope", h)
    assert not auth.check_password(PASSWORD, "garbage")


def test_everything_needs_sign_in(client):
    assert client.get("/admin/api/business").status_code == 401
    assert client.get("/admin/api/stock").status_code == 401
    assert client.get("/admin/api/auth/me").json()["signed_in"] is False
    assert client.get("/admin/api/version").status_code == 200
    assert client.get("/", follow_redirects=False).headers["location"] == "/admin/"


def test_sign_in_and_out(client):
    assert login(client, password="wrong").status_code == 401
    r = login(client)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/admin" in cookie
    assert client.get("/admin/api/auth/me").json()["signed_in"] is True
    assert client.get("/admin/api/business").status_code == 200
    client.post("/admin/api/auth/logout")
    assert client.get("/admin/api/business").status_code == 401


def test_forged_or_expired_cookie_rejected(client, monkeypatch):
    client.cookies.set(auth.COOKIE, "owner@example.com|9999999999|deadbeef", path="/admin")
    assert client.get("/admin/api/business").status_code == 401
    a = auth.Auth("owner@example.com", auth.hash_password(PASSWORD), "x" * 40)
    good = a.make_session()
    assert a.session_ok(good)
    monkeypatch.setattr(auth.time, "time", lambda: 9_999_999_999)
    assert not a.session_ok(good)


def test_lock_out_after_five_wrong_tries(client):
    for _ in range(5):
        assert login(client, password="wrong").status_code == 401
    r = login(client)  # even the right password is refused while locked
    assert r.status_code == 429 and "Try again" in r.json()["detail"]


def test_not_set_up_fails_closed(tmp_path, monkeypatch):
    for k in ("ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"):
        monkeypatch.delenv(k, raising=False)
    c = TestClient(server.build_app(str(tmp_path / "v.db")))
    assert c.get("/admin/api/business").status_code == 401
    assert login(c).status_code == 503


def test_build_files_cannot_escape(client):
    login(client)
    assert b"def create_app" not in client.get("/admin/..%2f..%2fapi/server.py").content
