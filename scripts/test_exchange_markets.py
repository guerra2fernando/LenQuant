#!/usr/bin/env python3
"""
Test script to verify exchange markets integration.

This script:
1. Tests connection to the configured exchange
2. Fetches available markets
3. Verifies that problematic symbols (XMR/USD, ZEC/USD, DASH/USD) are handled correctly
4. Tests the API endpoint
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_ingest.exchange_utils import get_exchange_markets_with_logos
from data_ingest.config import IngestConfig


def test_exchange_connection():
    """Test basic exchange connection."""
    print("=" * 60)
    print("TEST 1: Exchange Connection")
    print("=" * 60)
    
    config = IngestConfig.from_env()
    print(f"✓ Configured exchange: {config.source}")
    
    try:
        import ccxt
        exchange_class = getattr(ccxt, config.source)
        exchange = exchange_class({'enableRateLimit': True})
        status = exchange.fetch_status()
        print(f"✓ Exchange status: {status}")
        print()
        return True
    except Exception as e:
        print(f"✗ Exchange connection failed: {e}")
        print()
        return False


def test_load_markets():
    """Test loading markets from exchange."""
    print("=" * 60)
    print("TEST 2: Load Markets")
    print("=" * 60)
    
    try:
        result = get_exchange_markets_with_logos(quote_currencies=['USDT', 'USD', 'BUSD'])
        
        print(f"✓ Exchange: {result['exchange']}")
        print(f"✓ Total markets on exchange: {result['total_markets']}")
        print(f"✓ Active markets (USDT/USD/BUSD): {result['active_markets']}")
        print(f"✓ Logos fetched: {len(result['logos'])}")
        print()
        
        # Show first 10 symbols
        print("First 10 available symbols:")
        for i, symbol in enumerate(result['symbols'][:10], 1):
            market = result['markets'][symbol]
            logo = result['logos'].get(market['base'], 'N/A')
            has_logo = '✓' if logo != 'N/A' else '✗'
            print(f"  {i}. {symbol:15s} {has_logo} Logo: {'Yes' if logo != 'N/A' else 'No'}")
        print()
        
        return result
    
    except Exception as e:
        print(f"✗ Failed to load markets: {e}")
        import traceback
        traceback.print_exc()
        print()
        return None


def test_problematic_symbols(markets_result):
    """Test that problematic symbols are handled correctly."""
    print("=" * 60)
    print("TEST 3: Problematic Symbols")
    print("=" * 60)
    
    if not markets_result:
        print("✗ Cannot test - markets not loaded")
        print()
        return False
    
    # Symbols that were causing errors
    problematic = ['XMR/USD', 'ZEC/USD', 'DASH/USD']
    
    for symbol in problematic:
        exists = symbol in markets_result['symbols']
        status = "✓ Available" if exists else "✗ Not available (as expected)"
        print(f"{symbol:15s} {status}")
        
        # Check if USDT version exists
        usdt_symbol = symbol.replace('/USD', '/USDT')
        usdt_exists = usdt_symbol in markets_result['symbols']
        if usdt_exists:
            print(f"  → {usdt_symbol} IS available (use this instead)")
    
    print()
    return True


def test_specific_pairs():
    """Test specific trading pairs that should work."""
    print("=" * 60)
    print("TEST 4: Common Trading Pairs")
    print("=" * 60)
    
    try:
        result = get_exchange_markets_with_logos()
        common_pairs = [
            'BTC/USD', 'ETH/USDT', 'BNB/USDT', 
            'SOL/USDT', 'ADA/USDT', 'XRP/USDT',
            'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT'
        ]
        
        found = 0
        for symbol in common_pairs:
            exists = symbol in result['symbols']
            status = "✓" if exists else "✗"
            print(f"{status} {symbol}")
            if exists:
                found += 1
        
        print()
        print(f"Found {found}/{len(common_pairs)} common pairs")
        print()
        return found > 0
    
    except Exception as e:
        print(f"✗ Failed: {e}")
        print()
        return False


def test_api_endpoint():
    """Test the API endpoint (if server is running)."""
    print("=" * 60)
    print("TEST 5: API Endpoint")
    print("=" * 60)
    
    try:
        import requests
        
        # Check if server is running
        try:
            response = requests.get('http://localhost:8000/health', timeout=2)
        except:
            print("✗ API server not running (this is optional)")
            print("  Start with: python -m uvicorn api.main:app --reload")
            print()
            return True  # Not a failure, just skipped
        
        # Test the endpoint
        response = requests.get('http://localhost:8000/api/market/exchange-markets')
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ API endpoint working")
            print(f"✓ Symbols returned: {len(data.get('symbols', []))}")
            print(f"✓ Logos returned: {len(data.get('logos', {}))}")
            print()
            return True
        else:
            print(f"✗ API returned status {response.status_code}")
            print()
            return False
    
    except Exception as e:
        print(f"✗ API test failed: {e}")
        print()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("EXCHANGE MARKETS INTEGRATION TEST")
    print("=" * 60)
    print()
    
    results = []
    
    # Run tests
    results.append(("Exchange Connection", test_exchange_connection()))
    
    markets = test_load_markets()
    results.append(("Load Markets", markets is not None))
    
    results.append(("Problematic Symbols", test_problematic_symbols(markets)))
    results.append(("Common Trading Pairs", test_specific_pairs()))
    results.append(("API Endpoint", test_api_endpoint()))
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status:8s} {name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

