import base64
import hashlib
import hmac
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import qrcode
from jose import JWTError, jwt
import bcrypt
from app.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    # Truncate to 72 bytes if needed per bcrypt spec
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(
    subject: str,
    role: str,
    email: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": subject,
        "app_role": role,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return {}


# -------------------------------------------------------------
# Ticket QR Signing and Verification
# -------------------------------------------------------------

def sign_qr_payload(payload_str: str) -> str:
    """Calculates HMAC-SHA256 signature for payload string"""
    signature = hmac.new(
        settings.QR_HMAC_SECRET.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return signature


def generate_qr_ticket_string(ticket_id: str, trip_id: str, issued_at: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Constructs QR payload, computes HMAC-SHA256 signature,
    and returns (full_qr_string, raw_payload_json, signature)
    Format: <base64url(payload)>.<signature>
    """
    if not issued_at:
        issued_at = datetime.now(timezone.utc).isoformat()

    payload_dict = {
        "ticket_id": str(ticket_id),
        "trip_id": str(trip_id),
        "issued_at": issued_at
    }
    payload_json = json.dumps(payload_dict, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    signature = sign_qr_payload(payload_b64)
    full_qr_string = f"{payload_b64}.{signature}"

    return full_qr_string, payload_json, signature


def parse_and_verify_qr_string(qr_string: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    Verifies full QR string of format: <base64url(payload)>.<signature>
    Returns: (is_valid, payload_dict, error_message)
    """
    parts = qr_string.strip().split(".")
    if len(parts) != 2:
        return False, None, "Invalid QR code format. Expected <payload>.<signature>"

    payload_b64, signature = parts[0], parts[1]

    # Verify signature
    expected_sig = sign_qr_payload(payload_b64)
    if not hmac.compare_digest(expected_sig, signature):
        return False, None, "QR signature verification failed (tampered ticket)"

    # Base64 decode payload
    try:
        # Add padding back if necessary
        padding = "=" * ((4 - len(payload_b64) % 4) % 4)
        raw_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
        data = json.loads(raw_json)
        return True, data, ""
    except Exception as e:
        return False, None, f"Failed to decode QR payload: {str(e)}"


def generate_qr_image_data_uri(content: str) -> str:
    """Generates a data URI PNG for direct embedding in passenger UI"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(content)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_img}"
