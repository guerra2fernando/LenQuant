"""
Encryption Utilities for Secure Storage of API Credentials

This module provides AES-256-GCM encryption for storing exchange API keys
and secrets securely in the database.

Security Features:
- AES-256-GCM encryption
- Unique initialization vector (IV) per encryption
- Key derivation from environment variable
- No plaintext storage
"""

import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
from typing import Tuple


# Get encryption key from environment
def _get_encryption_key() -> bytes:
    """
    Get or derive encryption key from environment variable.
    
    Returns:
        bytes: 32-byte encryption key for AES-256
    
    Raises:
        ValueError: If EXCHANGE_API_ENCRYPTION_KEY environment variable is not set
    """
    key_hex = os.getenv("EXCHANGE_API_ENCRYPTION_KEY")
    
    if not key_hex:
        # In development, use a default key (NEVER in production)
        if os.getenv("ENVIRONMENT", "development") == "development":
            print("WARNING: Using default encryption key for development. Set EXCHANGE_API_ENCRYPTION_KEY in production!")
            key_hex = "0" * 64  # 32 bytes = 64 hex chars
        else:
            raise ValueError(
                "EXCHANGE_API_ENCRYPTION_KEY environment variable must be set. "
                "Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
            )
    
    # Convert hex string to bytes
    return bytes.fromhex(key_hex)


def encrypt_api_credential(plaintext: str) -> str:
    """
    Encrypt API credential using AES-256-GCM.
    
    Args:
        plaintext: The API key or secret to encrypt
    
    Returns:
        Base64-encoded string containing IV + ciphertext format: "iv:ciphertext"
    
    Example:
        >>> encrypted = encrypt_api_credential("my_secret_api_key")
        >>> print(encrypted)
        'a1b2c3d4...:e5f6g7h8...'
    """
    if not plaintext:
        return ""
    
    # Get encryption key
    key = _get_encryption_key()
    
    # Generate random 12-byte IV (nonce)
    iv = os.urandom(12)
    
    # Create cipher
    aesgcm = AESGCM(key)
    
    # Encrypt
    ciphertext = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    
    # Encode IV and ciphertext as base64
    iv_b64 = base64.b64encode(iv).decode('utf-8')
    ciphertext_b64 = base64.b64encode(ciphertext).decode('utf-8')
    
    # Return as "iv:ciphertext"
    return f"{iv_b64}:{ciphertext_b64}"


def decrypt_api_credential(encrypted: str) -> str:
    """
    Decrypt API credential using AES-256-GCM.
    
    Args:
        encrypted: Base64-encoded string in format "iv:ciphertext"
    
    Returns:
        Decrypted plaintext string
    
    Raises:
        ValueError: If encrypted string is malformed or decryption fails
    
    Example:
        >>> plaintext = decrypt_api_credential("a1b2c3d4...:e5f6g7h8...")
        >>> print(plaintext)
        'my_secret_api_key'
    """
    if not encrypted:
        return ""
    
    try:
        # Split IV and ciphertext
        iv_b64, ciphertext_b64 = encrypted.split(":", 1)
        
        # Decode from base64
        iv = base64.b64decode(iv_b64)
        ciphertext = base64.b64decode(ciphertext_b64)
        
        # Get encryption key
        key = _get_encryption_key()
        
        # Create cipher
        aesgcm = AESGCM(key)
        
        # Decrypt
        plaintext_bytes = aesgcm.decrypt(iv, ciphertext, None)
        
        return plaintext_bytes.decode('utf-8')
    
    except Exception as e:
        raise ValueError(f"Failed to decrypt credential: {str(e)}")


def mask_api_key(api_key: str, visible_chars: int = 4) -> str:
    """
    Mask API key for display, showing only last N characters.
    
    Args:
        api_key: The API key to mask
        visible_chars: Number of characters to show at the end (default: 4)
    
    Returns:
        Masked string like "***xyz"
    
    Example:
        >>> mask_api_key("1234567890abcdef")
        '***cdef'
    """
    if not api_key or len(api_key) <= visible_chars:
        return "***"
    
    return f"***{api_key[-visible_chars:]}"


def generate_encryption_key() -> str:
    """
    Generate a new 32-byte (256-bit) encryption key for production use.
    
    Returns:
        Hex-encoded 32-byte key (64 hex characters)
    
    Usage:
        Set this value as EXCHANGE_API_ENCRYPTION_KEY environment variable.
    
    Example:
        >>> key = generate_encryption_key()
        >>> print(f"EXCHANGE_API_ENCRYPTION_KEY={key}")
    """
    import secrets
    return secrets.token_hex(32)


# Test encryption/decryption
if __name__ == "__main__":
    # Generate a test key
    test_key = generate_encryption_key()
    print(f"Generated encryption key (save to .env):")
    print(f"EXCHANGE_API_ENCRYPTION_KEY={test_key}")
    print()
    
    # Set for testing
    os.environ["EXCHANGE_API_ENCRYPTION_KEY"] = test_key
    
    # Test encryption/decryption
    test_secret = "test_api_secret_1234567890"
    print(f"Original: {test_secret}")
    
    encrypted = encrypt_api_credential(test_secret)
    print(f"Encrypted: {encrypted}")
    
    decrypted = decrypt_api_credential(encrypted)
    print(f"Decrypted: {decrypted}")
    
    # Verify
    assert test_secret == decrypted, "Encryption/decryption failed!"
    print("✅ Encryption test passed!")
    
    # Test masking
    masked = mask_api_key(test_secret)
    print(f"Masked: {masked}")

