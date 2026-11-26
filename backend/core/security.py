"""
Password hashing and access tokens, built on the standard library only.

* Passwords: PBKDF2-HMAC-SHA256 with a per-user random salt.
* Tokens: compact HS256 JWTs (header.payload.signature) with `sub`, `iat`
  and `exp` claims, verified in constant time.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional

from backend.core.config.config import settings

PBKDF2_ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _sign(message: bytes) -> str:
    return _b64(hmac.new(settings.JWT_SECRET.encode("utf-8"), message, hashlib.sha256).digest())


def create_access_token(subject: str, extra: Optional[Dict[str, Any]] = None) -> str:
    now = int(time.time())
    payload = {"sub": subject, "iat": now, "exp": now + settings.JWT_EXPIRE_MINUTES * 60, **(extra or {})}
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode("ascii")
    return f"{header}.{body}.{_sign(signing_input)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Returns the payload for a valid, unexpired token, otherwise None."""
    try:
        header_b64, body_b64, signature = token.split(".")
        header = json.loads(_unb64(header_b64))
        if header.get("alg") != "HS256":
            return None
        expected = _sign(f"{header_b64}.{body_b64}".encode("ascii"))
        if not hmac.compare_digest(expected, signature):
            return None
        payload = json.loads(_unb64(body_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
