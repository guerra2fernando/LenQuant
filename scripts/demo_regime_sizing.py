"""Demo script for regime-based position sizing integration.

This script demonstrates how regime-based risk management adjusts position
sizes based on current market conditions.

Usage:
    python scripts/demo_regime_sizing.py --symbol "BTC/USDT" --base-size 1000
    python scripts/demo_regime_sizing.py --all-symbols --interval 1h
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from exec.risk_manager import MacroSettings, RiskManager, TradingSettings
from macro.regime import RegimeDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def demo_single_symbol(symbol: str, base_size_usd: float, interval: str = "1h") -> None:
    """Demonstrate regime sizing for a single symbol.
    
    Args:
        symbol: Trading pair symbol (e.g., 'BTC/USDT')
        base_size_usd: Base position size in USD before regime adjustment
        interval: Timeframe for regime detection
    """
    logger.info("=" * 80)
    logger.info("Regime-Based Position Sizing Demo")
    logger.info("=" * 80)
    logger.info("")
    logger.info(f"Symbol: {symbol}")
    logger.info(f"Base Position Size: ${base_size_usd:,.2f}")
    logger.info(f"Interval: {interval}")
    logger.info("")
    
    # Initialize regime detector
    detector = RegimeDetector()
    
    # Get current regime
    logger.info("Detecting current market regime...")
    regime = detector.get_latest_regime(symbol)
    
    if regime is None:
        logger.warning(f"No regime data available for {symbol}")
        logger.info("Please run: python scripts/backfill_regimes.py --symbols %s --interval %s", symbol, interval)
        return
    
    logger.info("")
    logger.info("Current Market Regime:")
    logger.info(f"  Trend:       {regime.trend_regime.value}")
    logger.info(f"  Volatility:  {regime.volatility_regime.value}")
    logger.info(f"  Confidence:  {regime.confidence:.2%}")
    logger.info(f"  Timestamp:   {regime.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    logger.info("")
    logger.info("Regime Features:")
    logger.info(f"  ATR:         {regime.features.atr:.2f} ({regime.features.atr_pct:.2%})")
    logger.info(f"  ADX:         {regime.features.adx:.2f}")
    logger.info(f"  BB Width:    {regime.features.bb_width:.4f}")
    logger.info(f"  MA Slope (S): {regime.features.ma_slope_short:.4f}")
    logger.info(f"  MA Slope (L): {regime.features.ma_slope_long:.4f}")
    logger.info(f"  Vol Std:     {regime.features.volatility_std:.4f}")
    logger.info("")
    
    # Initialize risk manager with regime risk enabled
    macro_settings = MacroSettings(regime_risk_enabled=True)
    risk_manager = RiskManager(
        settings=TradingSettings(),
        macro_settings=macro_settings,
    )
    
    # Get regime multiplier
    multiplier, regime_desc = risk_manager.get_regime_multiplier(symbol)
    
    logger.info("Regime Multiplier Analysis:")
    logger.info(f"  Description: {regime_desc}")
    logger.info(f"  Multiplier:  {multiplier:.2f}x")
    logger.info("")
    logger.info("  Default Multipliers:")
    logger.info(f"    TRENDING_UP:       {macro_settings.regime_multipliers.TRENDING_UP:.2f}x")
    logger.info(f"    TRENDING_DOWN:     {macro_settings.regime_multipliers.TRENDING_DOWN:.2f}x")
    logger.info(f"    SIDEWAYS:          {macro_settings.regime_multipliers.SIDEWAYS:.2f}x")
    logger.info(f"    HIGH_VOLATILITY:   {macro_settings.regime_multipliers.HIGH_VOLATILITY:.2f}x")
    logger.info(f"    LOW_VOLATILITY:    {macro_settings.regime_multipliers.LOW_VOLATILITY:.2f}x")
    logger.info(f"    NORMAL_VOLATILITY: {macro_settings.regime_multipliers.NORMAL_VOLATILITY:.2f}x")
    logger.info("")
    
    # Calculate position size
    sizing = risk_manager.calculate_position_size(
        symbol=symbol,
        base_size_usd=base_size_usd,
        apply_regime_multiplier=True,
    )
    
    logger.info("Position Sizing Calculation:")
    logger.info(f"  Base Size:        ${sizing['base_size_usd']:,.2f}")
    logger.info(f"  Regime Multiplier: {sizing['regime_multiplier']:.2f}x")
    logger.info(f"  Final Size:       ${sizing['final_size_usd']:,.2f}")
    logger.info(f"  Adjustment:       ${sizing['final_size_usd'] - sizing['base_size_usd']:+,.2f} ({(sizing['regime_multiplier'] - 1) * 100:+.1f}%)")
    logger.info(f"  Regime Adjusted:  {'Yes' if sizing['regime_adjusted'] else 'No'}")
    logger.info("")
    
    # Explain the reasoning
    if sizing['regime_adjusted']:
        if multiplier < 1.0:
            logger.info("⚠️  RISK REDUCTION APPLIED")
            logger.info(f"   Position size reduced to {multiplier:.1%} due to {regime_desc} regime.")
            logger.info(f"   This helps protect capital during unfavorable market conditions.")
        elif multiplier > 1.0:
            logger.info("✅ POSITION SIZE INCREASED")
            logger.info(f"   Position size increased to {multiplier:.1%} due to {regime_desc} regime.")
            logger.info(f"   This capitalizes on favorable market conditions.")
        else:
            logger.info("ℹ️  NO ADJUSTMENT")
            logger.info(f"   Regime is neutral, no position size adjustment applied.")
    else:
        logger.info("ℹ️  NO ADJUSTMENT")
        logger.info(f"   Regime multiplier is 1.0, no adjustment needed.")
    
    logger.info("")
    logger.info("=" * 80)


def demo_comparison(symbols: list[str], base_size_usd: float) -> None:
    """Compare regime sizing across multiple symbols.
    
    Args:
        symbols: List of trading pair symbols
        base_size_usd: Base position size in USD
    """
    logger.info("=" * 80)
    logger.info("Multi-Symbol Regime Comparison")
    logger.info("=" * 80)
    logger.info("")
    
    # Initialize
    detector = RegimeDetector()
    macro_settings = MacroSettings(regime_risk_enabled=True)
    risk_manager = RiskManager(
        settings=TradingSettings(),
        macro_settings=macro_settings,
    )
    
    results = []
    for symbol in symbols:
        regime = detector.get_latest_regime(symbol)
        if regime is None:
            logger.warning(f"No regime data for {symbol}, skipping...")
            continue
        
        multiplier, regime_desc = risk_manager.get_regime_multiplier(symbol)
        sizing = risk_manager.calculate_position_size(
            symbol=symbol,
            base_size_usd=base_size_usd,
            apply_regime_multiplier=True,
        )
        
        results.append({
            "symbol": symbol,
            "trend": regime.trend_regime.value,
            "volatility": regime.volatility_regime.value,
            "confidence": regime.confidence,
            "multiplier": multiplier,
            "base_size": base_size_usd,
            "final_size": sizing["final_size_usd"],
            "adjustment": sizing["final_size_usd"] - base_size_usd,
        })
    
    if not results:
        logger.error("No regime data available for any symbols")
        return
    
    # Print comparison table
    logger.info(f"{'Symbol':<12} {'Trend':<15} {'Volatility':<18} {'Conf':<6} {'Mult':<6} {'Base':<12} {'Final':<12} {'Adj':<12}")
    logger.info("-" * 120)
    
    for r in results:
        logger.info(
            f"{r['symbol']:<12} "
            f"{r['trend']:<15} "
            f"{r['volatility']:<18} "
            f"{r['confidence']:<6.1%} "
            f"{r['multiplier']:<6.2f} "
            f"${r['base_size']:<11,.2f} "
            f"${r['final_size']:<11,.2f} "
            f"{r['adjustment']:+11,.2f}"
        )
    
    logger.info("")
    logger.info("Summary Statistics:")
    avg_multiplier = sum(r["multiplier"] for r in results) / len(results)
    total_base = sum(r["base_size"] for r in results)
    total_final = sum(r["final_size"] for r in results)
    total_adj = total_final - total_base
    
    logger.info(f"  Average Multiplier:   {avg_multiplier:.2f}x")
    logger.info(f"  Total Base Exposure:  ${total_base:,.2f}")
    logger.info(f"  Total Final Exposure: ${total_final:,.2f}")
    logger.info(f"  Total Adjustment:     ${total_adj:+,.2f} ({(total_final / total_base - 1) * 100:+.1f}%)")
    logger.info("")
    logger.info("=" * 80)


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Demonstrate regime-based position sizing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--symbol",
        type=str,
        help="Trading pair symbol (e.g., 'BTC/USDT')",
    )
    parser.add_argument(
        "--base-size",
        type=float,
        default=1000.0,
        help="Base position size in USD (default: 1000)",
    )
    parser.add_argument(
        "--interval",
        type=str,
        default="1h",
        help="Timeframe for regime detection (default: 1h)",
    )
    parser.add_argument(
        "--all-symbols",
        action="store_true",
        help="Compare regime sizing across all available symbols",
    )
    parser.add_argument(
        "--symbols",
        type=str,
        help="Comma-separated list of symbols for comparison",
    )
    
    args = parser.parse_args()
    
    if args.all_symbols or args.symbols:
        # Multi-symbol comparison mode
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(",")]
        else:
            # Get common symbols
            symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT"]
        
        demo_comparison(symbols, args.base_size)
    elif args.symbol:
        # Single symbol detailed demo
        demo_single_symbol(args.symbol, args.base_size, args.interval)
    else:
        parser.print_help()
        logger.error("\nError: Please specify either --symbol or --all-symbols")
        sys.exit(1)


if __name__ == "__main__":
    main()

