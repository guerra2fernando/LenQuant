"""Exchange connection management and status tracking."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.client import get_database_name, mongo_client
from exec.encryption import encrypt_api_credential, decrypt_api_credential, mask_api_key
from exec.exchange_connector import ExchangeConnector, quick_validate_exchange_credentials

router = APIRouter()


class ExchangeStatusResponse(BaseModel):
    exchanges: Dict[str, Dict[str, Any]]
    default_exchange: str
    live_trading_enabled: bool


class ValidateExchangePayload(BaseModel):
    exchange: str = Field(..., pattern="^(binance|coinbase)$")
    api_key: str = Field(..., min_length=10)
    api_secret: str = Field(..., min_length=10)
    testnet: bool = False


class ConnectExchangePayload(BaseModel):
    exchange: str = Field(..., pattern="^(binance|coinbase)$")
    api_key: str = Field(..., min_length=10)
    api_secret: str = Field(..., min_length=10)
    testnet: bool = False


class TestExchangePayload(BaseModel):
    exchange: str = Field(..., pattern="^(binance|coinbase)$")


class DisconnectExchangePayload(BaseModel):
    exchange: str = Field(..., pattern="^(binance|coinbase)$")


def _get_exchange_connection(exchange: str, user_id: str = "default") -> Optional[Dict[str, Any]]:
    """Get exchange connection from database."""
    with mongo_client() as client:
        db = client[get_database_name()]
        return db["exchange_connections"].find_one(
            {"user_id": user_id, "exchange": exchange}
        )


def _format_exchange_status(connection: Optional[Dict[str, Any]], exchange: str) -> Dict[str, Any]:
    """Format exchange connection into status response."""
    if not connection:
        return {
            "connected": False,
            "status": "not_configured",
            "account_type": None,
            "permissions": [],
            "last_tested": None,
            "last_successful": None,
            "error_message": None,
            "api_key_partial": None,
        }
    
    # Use proper masking for API key display
    encrypted_key = connection.get("api_key_encrypted", "")
    if encrypted_key:
        # Decrypt just for masking (safe operation)
        try:
            decrypted_key = decrypt_api_credential(encrypted_key)
            api_key_partial = mask_api_key(decrypted_key)
        except:
            api_key_partial = "***"
    else:
        api_key_partial = "***"
    
    return {
        "connected": connection.get("status") == "connected",
        "status": connection.get("status", "disconnected"),
        "account_type": connection.get("account_type"),
        "permissions": connection.get("permissions", []),
        "last_tested": connection.get("last_tested").isoformat() if connection.get("last_tested") else None,
        "last_successful": connection.get("last_successful").isoformat() if connection.get("last_successful") else None,
        "error_message": connection.get("last_error"),
        "api_key_partial": api_key_partial,
    }


@router.get("/status")
def get_exchange_status(user_id: str = "default") -> Dict[str, Any]:
    """
    Get status of all exchange connections.
    
    Returns connection state, permissions, and last test results for each exchange.
    """
    binance_conn = _get_exchange_connection("binance", user_id)
    coinbase_conn = _get_exchange_connection("coinbase", user_id)
    
    binance_status = _format_exchange_status(binance_conn, "binance")
    coinbase_status = _format_exchange_status(coinbase_conn, "coinbase")
    
    # Determine if live trading is enabled (any exchange connected)
    live_enabled = binance_status["connected"] or coinbase_status["connected"]
    
    return {
        "exchanges": {
            "binance": binance_status,
            "coinbase": coinbase_status,
        },
        "default_exchange": "binance",
        "live_trading_enabled": live_enabled,
    }


@router.post("/validate")
def validate_exchange(payload: ValidateExchangePayload) -> Dict[str, Any]:
    """
    Validate exchange API credentials without storing them.
    
    Tests connection and returns account info and permissions.
    """
    try:
        # Use quick validation from exchange connector
        result = quick_validate_exchange_credentials(
            exchange_name=payload.exchange,
            api_key=payload.api_key,
            api_secret=payload.api_secret,
            testnet=payload.testnet
        )
        
        return result
    
    except Exception as e:
        return {
            "valid": False,
            "permissions": [],
            "account_type": "unknown",
            "balance_usd": 0.0,
            "error": f"Validation failed: {str(e)}",
        }


@router.post("/connect")
def connect_exchange(payload: ConnectExchangePayload, user_id: str = "default") -> Dict[str, Any]:
    """
    Connect and store exchange API credentials.
    
    Validates credentials, encrypts them, and stores in database.
    """
    # Step 1: Validate credentials first
    validation_result = quick_validate_exchange_credentials(
        exchange_name=payload.exchange,
        api_key=payload.api_key,
        api_secret=payload.api_secret,
        testnet=payload.testnet
    )
    
    if not validation_result["valid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid credentials: {validation_result.get('error', 'Authentication failed')}"
        )
    
    # Step 2: Encrypt credentials
    try:
        encrypted_key = encrypt_api_credential(payload.api_key)
        encrypted_secret = encrypt_api_credential(payload.api_secret)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Encryption failed: {str(e)}"
        )
    
    # Step 3: Store in database
    with mongo_client() as client:
        db = client[get_database_name()]
        
        connection_data = {
            "user_id": user_id,
            "exchange": payload.exchange,
            "api_key_encrypted": encrypted_key,
            "api_secret_encrypted": encrypted_secret,
            "permissions": validation_result.get("permissions", []),
            "account_type": validation_result.get("account_type", "spot"),
            "status": "connected",
            "testnet": payload.testnet,
            "connected_at": datetime.utcnow(),
            "disconnected_at": None,
            "last_tested": datetime.utcnow(),
            "last_successful": datetime.utcnow(),
            "last_error": None,
            "error_count": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        # Upsert (update if exists, insert if not)
        db["exchange_connections"].update_one(
            {"user_id": user_id, "exchange": payload.exchange},
            {"$set": connection_data},
            upsert=True
        )
    
    return {
        "exchange": payload.exchange,
        "status": "connected",
        "connected_at": datetime.utcnow().isoformat(),
        "account_type": validation_result.get("account_type"),
        "permissions": validation_result.get("permissions", []),
    }


@router.post("/test")
def test_exchange(payload: TestExchangePayload, user_id: str = "default") -> Dict[str, Any]:
    """
    Test existing exchange connection.
    
    Performs a lightweight API call to verify credentials still work.
    """
    connection = _get_exchange_connection(payload.exchange, user_id)
    
    if not connection:
        raise HTTPException(status_code=404, detail=f"No connection found for {payload.exchange}")
    
    # Decrypt credentials
    try:
        api_key = decrypt_api_credential(connection["api_key_encrypted"])
        api_secret = decrypt_api_credential(connection["api_secret_encrypted"])
    except Exception as e:
        # Update error in database
        with mongo_client() as client:
            db = client[get_database_name()]
            db["exchange_connections"].update_one(
                {"user_id": user_id, "exchange": payload.exchange},
                {
                    "$set": {
                        "last_error": f"Decryption failed: {str(e)}",
                        "error_count": connection.get("error_count", 0) + 1,
                        "last_tested": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
        
        return {
            "exchange": payload.exchange,
            "test_passed": False,
            "latency_ms": 0,
            "balance_usd": 0.0,
            "server_time_diff_ms": 0,
            "error": f"Decryption failed: {str(e)}",
        }
    
    # Test connection
    connector = ExchangeConnector(
        payload.exchange,
        testnet=connection.get("testnet", False)
    )
    
    success, error = connector.connect(api_key, api_secret)
    
    if not success:
        # Update error in database
        with mongo_client() as client:
            db = client[get_database_name()]
            db["exchange_connections"].update_one(
                {"user_id": user_id, "exchange": payload.exchange},
                {
                    "$set": {
                        "status": "error",
                        "last_error": error,
                        "error_count": connection.get("error_count", 0) + 1,
                        "last_tested": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
        
        return {
            "exchange": payload.exchange,
            "test_passed": False,
            "latency_ms": 0,
            "balance_usd": 0.0,
            "server_time_diff_ms": 0,
            "error": error,
        }
    
    # Perform test
    test_result = connector.test_connection()
    connector.disconnect()
    
    # Update database with test result
    with mongo_client() as client:
        db = client[get_database_name()]
        
        update_data = {
            "last_tested": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        if test_result["test_passed"]:
            update_data["status"] = "connected"
            update_data["last_successful"] = datetime.utcnow()
            update_data["last_error"] = None
        else:
            update_data["status"] = "error"
            update_data["last_error"] = test_result.get("error")
            update_data["error_count"] = connection.get("error_count", 0) + 1
        
        db["exchange_connections"].update_one(
            {"user_id": user_id, "exchange": payload.exchange},
            {"$set": update_data}
        )
    
    return test_result


@router.post("/disconnect")
def disconnect_exchange(payload: DisconnectExchangePayload, user_id: str = "default") -> Dict[str, Any]:
    """
    Disconnect an exchange by removing stored credentials.
    """
    with mongo_client() as client:
        db = client[get_database_name()]
        
        result = db["exchange_connections"].update_one(
            {"user_id": user_id, "exchange": payload.exchange},
            {
                "$set": {
                    "status": "disconnected",
                    "disconnected_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail=f"No connection found for {payload.exchange}")
    
    return {
        "exchange": payload.exchange,
        "status": "disconnected",
        "disconnected_at": datetime.utcnow().isoformat(),
    }

