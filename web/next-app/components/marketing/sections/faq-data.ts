export const faqItems = [
  {
    question: "Is this a signal service that tells me what to trade?",
    answer:
      "No. LenQuant is a decision support tool that shows you market conditions objectively. It does not tell you what to trade, when to enter, or guarantee any specific outcomes. It provides market regime analysis, leverage recommendations, and AI-powered context to help you make more informed decisions yourself.",
  },
  {
    question: "Does LenQuant guarantee profits?",
    answer:
      "No tool can guarantee trading profits. LenQuant helps you avoid trading in unfavorable conditions and prevents over-leveraging. If it stops you from one bad trade a month, it pays for itself — but ultimate trading decisions and their outcomes are your responsibility.",
  },
  {
    question: "Does it work with all Binance Futures symbols?",
    answer:
      "Yes! The extension works with ANY Binance Futures symbol. Our backend has pre-collected data for major symbols (BTC, ETH, etc.) with full ML predictions. For other symbols, the extension uses 'ephemeral analysis' — fetching data directly from Binance and providing real-time regime detection without needing pre-loaded data.",
  },
  {
    question: "Do I need to share my Binance API keys?",
    answer:
      "No. The extension reads public market data and extracts information from the Binance page DOM (like your current leverage). No API keys are required for the core analysis features. Trade sync (Premium) requires read-only API access, which only allows viewing trades — not executing them.",
  },
  {
    question: "What makes this different from TradingView indicators?",
    answer:
      "TradingView gives you raw indicators. LenQuant gives you: (1) regime classification with confidence scoring, (2) leverage recommendations based on volatility regime, (3) behavioral tracking across sessions, (4) AI-powered trade explanations, and (5) a cloud-based journal. It's a complete trading discipline system, not just indicators.",
  },
  {
    question: "How fast is the analysis?",
    answer:
      "The fast path analysis runs in under 500ms. The panel updates in under 50ms when you change symbols or timeframes. AI explanations take 3-5 seconds depending on complexity. Everything is designed for real-time trading workflows.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. Cancel anytime from your account settings. You'll retain access until the end of your current billing period. No long-term commitments or cancellation fees.",
  },
  {
    question: "Is there a refund policy?",
    answer:
      "For monthly subscriptions, we offer a 7-day money-back guarantee. For annual plans, you can request a pro-rated refund within 14 days of purchase. Contact support@lenquant.com for refund requests.",
  },
];
