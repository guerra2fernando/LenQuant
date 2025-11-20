"""Utilities for fetching exchange market information."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import requests

import ccxt  # type: ignore

from data_ingest.config import IngestConfig

logger = logging.getLogger(__name__)


def get_exchange_markets(exchange_name: str = "binance", 
                          quote_currencies: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Fetch available trading pairs from the exchange.
    
    Args:
        exchange_name: Name of the exchange (binance, kraken, coinbase, etc.)
        quote_currencies: List of quote currencies to filter (e.g., ['USDT', 'USD', 'BTC'])
                         If None, defaults to ['USDT', 'USD', 'BUSD']
    
    Returns:
        Dictionary with:
        - symbols: List of available trading pairs
        - markets: Full market info from exchange
        - quote_currencies: Available quote currencies
    """
    if quote_currencies is None:
        quote_currencies = ['USDT', 'USD', 'BUSD', 'EUR']
    
    try:
        # Initialize exchange
        exchange_class = getattr(ccxt, exchange_name.lower())
        exchange = exchange_class({'enableRateLimit': True})
        
        # Load markets
        logger.info(f"Loading markets from {exchange_name}...")
        markets = exchange.load_markets()
        
        # Filter active markets with desired quote currencies
        filtered_symbols = []
        market_info = {}
        
        for symbol, market in markets.items():
            if not market.get('active', False):
                continue
            
            # Extract quote currency
            quote = market.get('quote', '')
            if quote not in quote_currencies:
                continue
            
            filtered_symbols.append(symbol)
            market_info[symbol] = {
                'base': market.get('base', ''),
                'quote': quote,
                'active': market.get('active', False),
                'type': market.get('type', ''),
                'spot': market.get('spot', False),
            }
        
        # Sort symbols
        filtered_symbols.sort()
        
        logger.info(f"Found {len(filtered_symbols)} active markets on {exchange_name}")
        
        return {
            'symbols': filtered_symbols,
            'markets': market_info,
            'exchange': exchange_name,
            'quote_currencies': quote_currencies,
            'total_markets': len(markets),
            'active_markets': len(filtered_symbols),
        }
    
    except Exception as e:
        logger.error(f"Error loading markets from {exchange_name}: {e}")
        raise


def get_coingecko_coin_list() -> Dict[str, Dict[str, str]]:
    """
    Fetch cryptocurrency list from CoinGecko API.
    
    Returns:
        Dictionary mapping symbol to coin info (id, name, image)
    """
    try:
        url = "https://api.coingecko.com/api/v3/coins/list?include_platform=false"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        coins = response.json()
        
        # Create symbol mapping
        symbol_map = {}
        for coin in coins:
            symbol = coin.get('symbol', '').upper()
            if symbol:
                symbol_map[symbol] = {
                    'id': coin.get('id', ''),
                    'name': coin.get('name', ''),
                    'symbol': symbol,
                }
        
        logger.info(f"Loaded {len(symbol_map)} coins from CoinGecko")
        return symbol_map
    
    except Exception as e:
        logger.warning(f"Error fetching CoinGecko coin list: {e}")
        return {}


def get_coingecko_logos(symbols: List[str]) -> Dict[str, str]:
    """
    Fetch logo URLs for cryptocurrency symbols from CoinGecko.
    
    Args:
        symbols: List of trading pairs (e.g., ['BTC/USD', 'ETH/USDT'])
    
    Returns:
        Dictionary mapping symbol to logo URL
    """
    try:
        # Extract base currencies from trading pairs
        base_currencies = set()
        for symbol in symbols:
            base = symbol.split('/')[0].upper()
            base_currencies.add(base)
        
        # Get CoinGecko coin list
        coin_map = get_coingecko_coin_list()
        
        # Fetch detailed info with logos for matched coins
        logo_map = {}
        batch_ids = []
        
        for base in base_currencies:
            if base in coin_map:
                coin_id = coin_map[base]['id']
                batch_ids.append(coin_id)
        
        # Fetch market data in batches (CoinGecko allows up to 250 ids)
        if batch_ids:
            # Use markets endpoint for images
            ids_param = ','.join(batch_ids[:250])  # Limit to first 250
            url = f"https://api.coingecko.com/api/v3/coins/markets"
            params = {
                'vs_currency': 'usd',
                'ids': ids_param,
                'per_page': 250,
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            market_data = response.json()
            
            # Map to symbols
            for coin in market_data:
                symbol = coin.get('symbol', '').upper()
                image = coin.get('image', '')
                if symbol and image:
                    logo_map[symbol] = image
        
        logger.info(f"Fetched {len(logo_map)} logos from CoinGecko")
        return logo_map
    
    except Exception as e:
        logger.warning(f"Error fetching CoinGecko logos: {e}")
        return {}


def get_exchange_markets_with_logos(exchange_name: Optional[str] = None,
                                     quote_currencies: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Fetch available markets from exchange with logo URLs.
    
    Args:
        exchange_name: Exchange name (defaults to config)
        quote_currencies: Quote currencies to filter
    
    Returns:
        Dictionary with symbols, markets, and logo URLs
    """
    # Get config
    config = IngestConfig.from_env()
    if exchange_name is None:
        exchange_name = config.source
    
    # Get markets from exchange
    markets_data = get_exchange_markets(exchange_name, quote_currencies)
    
    # Get logos from CoinGecko
    logos = get_coingecko_logos(markets_data['symbols'])
    
    # Add logos to response
    markets_data['logos'] = logos
    
    return markets_data

