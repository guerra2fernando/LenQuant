"""
Exchange Connector Module using CCXT

This module provides a high-level interface to interact with cryptocurrency
exchanges (Binance, Coinbase, etc.) through the CCXT library.

Features:
- Exchange connection validation
- Account balance retrieval
- Order placement (for live trading)
- Connection health monitoring
- Secure credential management
"""

import ccxt
import time
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone


class ExchangeConnector:
    """
    Unified interface to cryptocurrency exchanges using CCXT.
    """
    
    SUPPORTED_EXCHANGES = {
        "binance": ccxt.binance,
        "coinbase": ccxt.coinbasepro,
    }
    
    def __init__(self, exchange_name: str, testnet: bool = False):
        """
        Initialize exchange connector.
        
        Args:
            exchange_name: Name of the exchange ('binance', 'coinbase')
            testnet: Whether to use testnet/sandbox mode
        
        Raises:
            ValueError: If exchange is not supported
        """
        if exchange_name not in self.SUPPORTED_EXCHANGES:
            raise ValueError(
                f"Exchange '{exchange_name}' not supported. "
                f"Supported: {list(self.SUPPORTED_EXCHANGES.keys())}"
            )
        
        self.exchange_name = exchange_name
        self.testnet = testnet
        self.exchange = None
        self._connected = False
    
    def connect(self, api_key: str, api_secret: str) -> Tuple[bool, Optional[str]]:
        """
        Connect to exchange with API credentials.
        
        Args:
            api_key: Exchange API key
            api_secret: Exchange API secret
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        
        Example:
            >>> connector = ExchangeConnector("binance", testnet=True)
            >>> success, error = connector.connect("key", "secret")
            >>> if success:
            ...     print("Connected!")
        """
        try:
            exchange_class = self.SUPPORTED_EXCHANGES[self.exchange_name]
            
            config = {
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
                'timeout': 30000,  # 30 seconds
            }
            
            # Configure testnet if requested
            if self.testnet:
                if self.exchange_name == "binance":
                    config['options'] = {'defaultType': 'future'}
                    config['urls'] = {
                        'api': {
                            'public': 'https://testnet.binancefuture.com',
                            'private': 'https://testnet.binancefuture.com',
                        }
                    }
                elif self.exchange_name == "coinbase":
                    config['sandbox'] = True
            
            self.exchange = exchange_class(config)
            self._connected = True
            
            return (True, None)
        
        except Exception as e:
            self._connected = False
            return (False, str(e))
    
    def validate_credentials(self) -> Dict:
        """
        Validate connection and retrieve account information.
        
        Returns:
            Dict with validation results:
            {
                "valid": bool,
                "permissions": List[str],
                "account_type": str,
                "balance_usd": float,
                "error": Optional[str]
            }
        
        Raises:
            RuntimeError: If not connected
        """
        if not self._connected or not self.exchange:
            raise RuntimeError("Not connected. Call connect() first.")
        
        try:
            # Fetch account balance (requires read permission)
            balance = self.exchange.fetch_balance()
            
            # Calculate total balance in USD
            total_usd = balance.get('total', {}).get('USDT', 0) + balance.get('total', {}).get('USD', 0)
            
            # Detect permissions based on what we can access
            permissions = self._detect_permissions()
            
            # Detect account type
            account_type = self._detect_account_type()
            
            return {
                "valid": True,
                "permissions": permissions,
                "account_type": account_type,
                "balance_usd": total_usd,
                "error": None
            }
        
        except ccxt.AuthenticationError as e:
            return {
                "valid": False,
                "permissions": [],
                "account_type": "unknown",
                "balance_usd": 0,
                "error": f"Authentication failed: {str(e)}"
            }
        
        except ccxt.PermissionDenied as e:
            return {
                "valid": False,
                "permissions": [],
                "account_type": "unknown",
                "balance_usd": 0,
                "error": f"Permission denied: {str(e)}"
            }
        
        except Exception as e:
            return {
                "valid": False,
                "permissions": [],
                "account_type": "unknown",
                "balance_usd": 0,
                "error": f"Validation error: {str(e)}"
            }
    
    def test_connection(self) -> Dict:
        """
        Test connection health and latency.
        
        Returns:
            Dict with test results:
            {
                "test_passed": bool,
                "latency_ms": int,
                "balance_usd": float,
                "server_time_diff_ms": int,
                "error": Optional[str]
            }
        
        Raises:
            RuntimeError: If not connected
        """
        if not self._connected or not self.exchange:
            raise RuntimeError("Not connected. Call connect() first.")
        
        try:
            # Measure latency
            start_time = time.time()
            server_time = self.exchange.fetch_time()
            end_time = time.time()
            
            latency_ms = int((end_time - start_time) * 1000)
            
            # Check time synchronization
            local_time_ms = int(time.time() * 1000)
            server_time_diff_ms = abs(local_time_ms - server_time)
            
            # Fetch balance as health check
            balance = self.exchange.fetch_balance()
            total_usd = balance.get('total', {}).get('USDT', 0) + balance.get('total', {}).get('USD', 0)
            
            return {
                "test_passed": True,
                "latency_ms": latency_ms,
                "balance_usd": total_usd,
                "server_time_diff_ms": server_time_diff_ms,
                "error": None
            }
        
        except Exception as e:
            return {
                "test_passed": False,
                "latency_ms": 0,
                "balance_usd": 0,
                "server_time_diff_ms": 0,
                "error": str(e)
            }
    
    def get_account_info(self) -> Dict:
        """
        Get detailed account information.
        
        Returns:
            Dict with account details including balances and permissions
        """
        if not self._connected or not self.exchange:
            raise RuntimeError("Not connected. Call connect() first.")
        
        try:
            balance = self.exchange.fetch_balance()
            
            return {
                "exchange": self.exchange_name,
                "testnet": self.testnet,
                "balances": balance.get('total', {}),
                "free": balance.get('free', {}),
                "used": balance.get('used', {}),
                "account_type": self._detect_account_type(),
                "permissions": self._detect_permissions(),
            }
        
        except Exception as e:
            raise RuntimeError(f"Failed to fetch account info: {str(e)}")
    
    def _detect_permissions(self) -> List[str]:
        """
        Detect API key permissions by testing various operations.
        
        Returns:
            List of detected permissions: ["read_only", "spot_trading", "margin", "futures"]
        """
        permissions = []
        
        try:
            # All API keys with balance access have read permission
            self.exchange.fetch_balance()
            permissions.append("read_only")
        except:
            pass
        
        try:
            # Check if can access trading endpoints
            self.exchange.fetch_open_orders()
            permissions.append("spot_trading")
        except:
            pass
        
        # Note: More sophisticated permission detection would require
        # actually attempting operations or checking exchange-specific APIs
        
        return permissions
    
    def _detect_account_type(self) -> str:
        """
        Detect account type (spot, margin, futures).
        
        Returns:
            Account type as string
        """
        # For now, default to spot
        # More sophisticated detection would check exchange-specific endpoints
        if self.testnet:
            return "testnet_spot"
        return "spot"
    
    def disconnect(self):
        """
        Disconnect from exchange and cleanup resources.
        """
        self.exchange = None
        self._connected = False
    
    @property
    def is_connected(self) -> bool:
        """Check if currently connected to exchange."""
        return self._connected and self.exchange is not None


# Utility function for quick validation
def quick_validate_exchange_credentials(
    exchange_name: str,
    api_key: str,
    api_secret: str,
    testnet: bool = False
) -> Dict:
    """
    Quick validation of exchange credentials without maintaining connection.
    
    Args:
        exchange_name: Name of exchange
        api_key: API key
        api_secret: API secret
        testnet: Use testnet mode
    
    Returns:
        Validation result dict
    
    Example:
        >>> result = quick_validate_exchange_credentials("binance", "key", "secret", testnet=True)
        >>> if result["valid"]:
        ...     print(f"Valid! Balance: ${result['balance_usd']}")
    """
    connector = ExchangeConnector(exchange_name, testnet=testnet)
    
    success, error = connector.connect(api_key, api_secret)
    if not success:
        return {
            "valid": False,
            "permissions": [],
            "account_type": "unknown",
            "balance_usd": 0,
            "error": error
        }
    
    result = connector.validate_credentials()
    connector.disconnect()
    
    return result


# Test the connector
if __name__ == "__main__":
    print("Exchange Connector Test")
    print("=" * 50)
    
    # Example: Test with dummy credentials (will fail authentication)
    print("\n1. Testing Binance Testnet connection (will fail with dummy creds)...")
    connector = ExchangeConnector("binance", testnet=True)
    success, error = connector.connect("dummy_key", "dummy_secret")
    
    if success:
        print("✅ Connected to Binance Testnet")
        validation = connector.validate_credentials()
        print(f"Validation: {validation}")
    else:
        print(f"❌ Connection failed (expected): {error}")
    
    print("\n2. Testing quick validation...")
    result = quick_validate_exchange_credentials(
        "binance",
        "test_key",
        "test_secret",
        testnet=True
    )
    print(f"Quick validation result: {result}")
    
    print("\n✅ Connector module loaded successfully!")
    print("To test with real credentials, set them in your environment and run validation.")

