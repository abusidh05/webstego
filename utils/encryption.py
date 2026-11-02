"""
encryption.py - Password-based AES-256-GCM encryption/decryption.
Key is derived from the user password via SHA-256.
"""

import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _derive_key(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def encrypt(data: bytes, password: str) -> bytes:
    """Encrypt bytes with AES-256-GCM. Returns base64(nonce[12] + ciphertext+tag)."""
    key = _derive_key(password)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    raw = nonce + ciphertext
    return base64.b64encode(raw)


def decrypt(token: bytes, password: str) -> bytes:
    """Decrypt a token produced by encrypt(). Raises ValueError on wrong password."""
    try:
        raw = base64.b64decode(token)
        nonce = raw[:12]
        ciphertext = raw[12:]
        key = _derive_key(password)
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, None)
    except Exception:
        raise ValueError("Decryption failed - wrong password or corrupted data.")
