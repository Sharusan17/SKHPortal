"""Admin login: one admin account from the environment, a signed session cookie, and a lock-out
after repeated wrong passwords.

Settings (Railway variables, or admin/.env locally):
  ADMIN_EMAIL           the email to sign in with
  ADMIN_PASSWORD_HASH   made with:  python api/auth.py  (asks for the password, prints the hash)
  SESSION_SECRET        any long random string; changing it signs everyone out

Nothing here logs or returns the password or the secret.
"""
import base64
import hashlib
import hmac
import os
import secrets
import threading
import time

ITERATIONS = 600_000
SESSION_HOURS = 12
COOKIE = "skh_admin"
MAX_FAILS = 5
LOCK_MINUTES = 15


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def check_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(got, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


class Auth:
    def __init__(self, email: str | None = None, password_hash: str | None = None, secret: str | None = None):
        self.email = (email if email is not None else os.environ.get("ADMIN_EMAIL", "")).strip().lower()
        self.password_hash = password_hash if password_hash is not None else os.environ.get("ADMIN_PASSWORD_HASH", "")
        self.secret = (secret if secret is not None else os.environ.get("SESSION_SECRET", "")).encode()
        self._fails: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    @property
    def configured(self) -> bool:
        return bool(self.email and self.password_hash and len(self.secret) >= 16)

    # -- sessions: "email|expires|signature", signed with SESSION_SECRET
    def _sign(self, payload: str) -> str:
        return hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()

    def make_session(self) -> str:
        payload = f"{self.email}|{int(time.time()) + SESSION_HOURS * 3600}"
        return f"{payload}|{self._sign(payload)}"

    def session_ok(self, value: str | None) -> bool:
        if not value or not self.configured:
            return False
        try:
            email, expires, sig = value.rsplit("|", 2)
        except ValueError:
            return False
        return (hmac.compare_digest(sig, self._sign(f"{email}|{expires}"))
                and email == self.email and int(expires) > time.time())

    # -- sign in, with a lock-out per client after repeated failures
    def locked_for(self, client: str, limit: int = MAX_FAILS) -> int:
        """Seconds until this client may try again (0 if not locked)."""
        with self._lock:
            recent = [t for t in self._fails.get(client, []) if t > time.time() - LOCK_MINUTES * 60]
            self._fails[client] = recent
            if len(recent) >= limit:
                return int(recent[0] + LOCK_MINUTES * 60 - time.time()) + 1
            return 0

    def login(self, client: str, email: str, password: str) -> bool:
        ok = (self.configured and hmac.compare_digest((email or "").strip().lower(), self.email)
              and check_password(password or "", self.password_hash))
        with self._lock:
            if ok:
                self._fails.pop(client, None)
            else:
                self._fails.setdefault(client, []).append(time.time())
        return ok

    def record_fail(self, client: str) -> None:
        with self._lock:
            self._fails.setdefault(client, []).append(time.time())


if __name__ == "__main__":
    import getpass

    pw = getpass.getpass("New admin password (12+ characters): ")
    if len(pw) < 12:
        raise SystemExit("Use at least 12 characters.")
    if pw != getpass.getpass("Same again: "):
        raise SystemExit("The two passwords didn't match.")
    print("ADMIN_PASSWORD_HASH=" + hash_password(pw))
    print("SESSION_SECRET=" + secrets.token_urlsafe(48))
