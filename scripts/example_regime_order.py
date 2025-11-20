"""Example: Placing orders with regime-based position sizing via API.

This script demonstrates how to place orders using the trade API with
regime-based position sizing enabled or disabled.

Usage:
    python scripts/example_regime_order.py --preview
    python scripts/example_regime_order.py --execute
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import requests

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

API_BASE_URL = "http://localhost:8000"


def preview_order_with_regime_sizing(
    symbol: str,
    side: str,
    quantity: float,
    price: float | None = None,
    apply_regime_sizing: bool = True,
) -> dict:
    """Preview an order with regime sizing enabled.
    
    Args:
        symbol: Trading pair symbol
        side: 'buy' or 'sell'
        quantity: Base quantity to trade
        price: Limit price (None for market order)
        apply_regime_sizing: Whether to apply regime-based adjustment
        
    Returns:
        Preview response with regime sizing details
    """
    order_request = {
        "symbol": symbol,
        "side": side,
        "quantity": quantity,
        "mode": "paper",
        "preview": True,
        "apply_regime_sizing": apply_regime_sizing,
    }
    
    if price:
        order_request["price"] = price
        order_request["type"] = "limit"
    else:
        order_request["type"] = "market"
    
    logger.info(f"Previewing order: {json.dumps(order_request, indent=2)}")
    
    response = requests.post(
        f"{API_BASE_URL}/api/trade/orders",
        json=order_request,
        timeout=10,
    )
    
    if response.status_code != 200:
        logger.error(f"Preview failed: {response.status_code} - {response.text}")
        return {}
    
    return response.json()


def place_order_with_regime_sizing(
    symbol: str,
    side: str,
    quantity: float,
    price: float | None = None,
    apply_regime_sizing: bool = True,
) -> dict:
    """Place an order with regime sizing enabled.
    
    Args:
        symbol: Trading pair symbol
        side: 'buy' or 'sell'
        quantity: Base quantity to trade
        price: Limit price (None for market order)
        apply_regime_sizing: Whether to apply regime-based adjustment
        
    Returns:
        Order response with execution details
    """
    order_request = {
        "symbol": symbol,
        "side": side,
        "quantity": quantity,
        "mode": "paper",
        "apply_regime_sizing": apply_regime_sizing,
    }
    
    if price:
        order_request["price"] = price
        order_request["type"] = "limit"
    else:
        order_request["type"] = "market"
    
    logger.info(f"Placing order: {json.dumps(order_request, indent=2)}")
    
    response = requests.post(
        f"{API_BASE_URL}/api/trade/orders",
        json=order_request,
        timeout=10,
    )
    
    if response.status_code != 200:
        logger.error(f"Order placement failed: {response.status_code} - {response.text}")
        return {}
    
    return response.json()


def compare_with_and_without_regime_sizing(symbol: str, quantity: float) -> None:
    """Compare order preview with and without regime sizing.
    
    Args:
        symbol: Trading pair symbol
        quantity: Base quantity to trade
    """
    logger.info("=" * 80)
    logger.info("Comparing Order Preview: With vs Without Regime Sizing")
    logger.info("=" * 80)
    logger.info("")
    
    # Preview without regime sizing
    logger.info("1. Without Regime Sizing:")
    preview_without = preview_order_with_regime_sizing(
        symbol=symbol,
        side="buy",
        quantity=quantity,
        apply_regime_sizing=False,
    )
    
    if preview_without:
        metadata = preview_without.get("metadata", {})
        risk = metadata.get("risk", {})
        logger.info(f"   Quantity:     {preview_without.get('quantity')}")
        logger.info(f"   Cost:         ${preview_without.get('cost', 0):,.2f}")
        logger.info(f"   Risk Status:  {risk.get('status', 'N/A')}")
        logger.info("")
    
    # Preview with regime sizing
    logger.info("2. With Regime Sizing:")
    preview_with = preview_order_with_regime_sizing(
        symbol=symbol,
        side="buy",
        quantity=quantity,
        apply_regime_sizing=True,
    )
    
    if preview_with:
        metadata = preview_with.get("metadata", {})
        risk = metadata.get("risk", {})
        regime_sizing = risk.get("regime_sizing", {})
        
        logger.info(f"   Base Quantity:     {quantity}")
        logger.info(f"   Adjusted Quantity: {preview_with.get('quantity')}")
        logger.info(f"   Cost:              ${preview_with.get('cost', 0):,.2f}")
        logger.info(f"   Risk Status:       {risk.get('status', 'N/A')}")
        logger.info("")
        
        if regime_sizing:
            logger.info("   Regime Sizing Details:")
            logger.info(f"     Base Size:        ${regime_sizing.get('base_size_usd', 0):,.2f}")
            logger.info(f"     Final Size:       ${regime_sizing.get('final_size_usd', 0):,.2f}")
            logger.info(f"     Multiplier:       {regime_sizing.get('regime_multiplier', 1.0):.2f}x")
            logger.info(f"     Regime:           {regime_sizing.get('regime_description', 'N/A')}")
            logger.info(f"     Adjusted:         {regime_sizing.get('regime_adjusted', False)}")
            logger.info("")
    
    # Calculate difference
    if preview_without and preview_with:
        qty_without = float(preview_without.get("quantity", 0))
        qty_with = float(preview_with.get("quantity", 0))
        diff = qty_with - qty_without
        pct_diff = (diff / qty_without * 100) if qty_without > 0 else 0
        
        logger.info("Comparison:")
        logger.info(f"   Quantity Difference: {diff:+.4f} ({pct_diff:+.1f}%)")
        logger.info("")
    
    logger.info("=" * 80)


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Example: Place orders with regime-based position sizing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--symbol",
        type=str,
        default="BTC/USD",
        help="Trading pair symbol (default: BTC/USD)",
    )
    parser.add_argument(
        "--quantity",
        type=float,
        default=0.01,
        help="Base quantity to trade (default: 0.01)",
    )
    parser.add_argument(
        "--price",
        type=float,
        help="Limit price (omit for market order)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Preview order with regime sizing comparison",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute order with regime sizing (paper mode)",
    )
    parser.add_argument(
        "--no-regime-sizing",
        action="store_true",
        help="Disable regime-based position sizing",
    )
    
    args = parser.parse_args()
    
    if args.preview:
        compare_with_and_without_regime_sizing(args.symbol, args.quantity)
    elif args.execute:
        apply_sizing = not args.no_regime_sizing
        logger.info(f"Placing order with regime sizing: {apply_sizing}")
        
        result = place_order_with_regime_sizing(
            symbol=args.symbol,
            side="buy",
            quantity=args.quantity,
            price=args.price,
            apply_regime_sizing=apply_sizing,
        )
        
        if result:
            logger.info("")
            logger.info("Order placed successfully!")
            logger.info(f"  Order ID:  {result.get('order_id')}")
            logger.info(f"  Status:    {result.get('status')}")
            logger.info(f"  Symbol:    {result.get('symbol')}")
            logger.info(f"  Side:      {result.get('side')}")
            logger.info(f"  Quantity:  {result.get('quantity')}")
            logger.info(f"  Price:     {result.get('price')}")
            
            metadata = result.get("metadata", {})
            regime_sizing = metadata.get("regime_sizing")
            if regime_sizing:
                logger.info("")
                logger.info("Regime sizing applied:")
                logger.info(f"  Multiplier: {regime_sizing.get('regime_multiplier', 1.0):.2f}x")
                logger.info(f"  Regime:     {regime_sizing.get('regime_description', 'N/A')}")
    else:
        parser.print_help()
        logger.error("\nError: Please specify either --preview or --execute")
        sys.exit(1)


if __name__ == "__main__":
    main()

