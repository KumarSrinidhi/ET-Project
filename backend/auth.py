import base64
import hmac
import hashlib
from datetime import datetime, timedelta
import json
from typing import Optional, List, Dict

SECRET_KEY = b"hackathon-demo-secret-key"

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def _b64url_decode(b64: str) -> bytes:
    padding = '=' * (4 - (len(b64) % 4))
    return base64.urlsafe_b64decode(b64 + padding)

def create_access_token(user_id: str, role_id: str, depots: List[str]):
    expire = datetime.utcnow() + timedelta(hours=24)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "role_id": role_id,
        "depots": depots,
        "exp": int(expire.timestamp())
    }
    header_b64 = _b64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload).encode('utf-8'))
    
    msg = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY, msg, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_token(token: str) -> Optional[Dict]:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
            
        msg = f"{parts[0]}.{parts[1]}".encode('utf-8')
        signature = hmac.new(SECRET_KEY, msg, hashlib.sha256).digest()
        expected_sig = _b64url_encode(signature)
        
        if not hmac.compare_digest(parts[2], expected_sig):
            return None
            
        payload = json.loads(_b64url_decode(parts[1]).decode('utf-8'))
        if datetime.utcnow().timestamp() > payload.get("exp", 0):
            return None
            
        return payload
    except Exception:
        return None
