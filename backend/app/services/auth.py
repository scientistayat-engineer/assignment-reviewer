"""Password hashing, signed session cookies and role guards (standard library only)."""
import base64
import hashlib
import hmac
import secrets
import time

from fastapi import Depends, HTTPException, Request

from .. import db
from ..config import settings

COOKIE = "session"
_fails: dict[str, list[float]] = {}


def hash_password(pw: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return base64.b64encode(salt).decode() + "$" + base64.b64encode(h).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        salt_b64, _ = stored.split("$", 1)
        return hmac.compare_digest(hash_password(pw, base64.b64decode(salt_b64)), stored)
    except Exception:
        return False


def _sign(payload: str) -> str:
    return hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_token(uid: int) -> str:
    payload = f"{uid}:{int(time.time()) + settings.session_hours * 3600}"
    return base64.urlsafe_b64encode(payload.encode()).decode() + "." + _sign(payload)


def parse_token(token: str) -> int | None:
    try:
        b64, sig = token.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(b64.encode()).decode()
        if not hmac.compare_digest(sig, _sign(payload)):
            return None
        uid, exp = payload.split(":")
        return int(uid) if int(exp) > time.time() else None
    except Exception:
        return None


def throttled(username: str) -> bool:
    now = time.time()
    _fails[username] = [t for t in _fails.get(username, []) if now - t < 60]
    return len(_fails[username]) >= 5


def record_fail(username: str):
    _fails.setdefault(username, []).append(time.time())


def current_user(request: Request) -> dict:
    uid = parse_token(request.cookies.get(COOKIE, ""))
    if uid is None:
        raise HTTPException(401, "Please log in")
    with db.conn() as c:
        r = c.execute("SELECT id, username, display_name, role FROM users WHERE id=?", (uid,)).fetchone()
    if not r:
        raise HTTPException(401, "Please log in")
    return dict(r)


def teacher_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "teacher":
        raise HTTPException(403, "Teacher access only")
    return user
