# LenQuant – Customer Q&A

## Can I see the charts and analysis of each crypto? Where?

1. In Easy Mode, open the top navigation and choose `Insights`. The “What the System Thinks” card shows per-asset forecasts with confidence badges, while “Best Strategies” ranks recent runs.
2. For full analytics, toggle to Advanced Mode from the header (`Mode` toggle) and visit `Analytics → Forecasts`. Use the horizon buttons (1m / 1h / 1d) to switch timeframes, review the sparkline trend for each symbol, and download the CSV if you need the raw data.
3. To inspect live trading cohorts, go to `Trading → Intraday Cohorts`. Select any cohort row to see bankroll utilisation, cohort PnL, guard-rail status, and the leaderboard for every strategy running in that cohort.

## I have 1,000 USD—what do I do next?

1. Start in Paper mode to stay risk-free: `Trading → Paper` tab, then use the Guided Trading Flow to let the system suggest orders with virtual balances.
2. Visit `Settings → Trading`. In `Account Modes`, keep the default mode set to `paper`, but in `Trading Settings` adjust:
   - `Max Trade (USD)` and `Max Daily Loss (USD)` to align with 1,000 USD
   - `Auto Mode` max trade/confidence if you intend to let the AI auto-execute later
3. Once comfortable, switch to `Trading → Testnet` to rehearse against the exchange sandbox (no real capital moves). Promote yourself to Live only when risk limits, alerts, and credentials are in place.

## Do I need to create a Binance and a ccxt account?

- You need a **Binance account (or another supported exchange)** with API keys; you do **not** sign up for ccxt—the platform already includes ccxt as its unified exchange connector.
- Binance setup (live or testnet):
  1. Sign up at binance.com or testnet.binance.vision, complete KYC, and enable 2FA.
  2. Create a new API key with **trading** permission enabled and **withdrawals disabled**.
  3. Copy the key/secret into your environment: duplicate `.env.example` to `.env` and fill `BINANCE_API_KEY` / `BINANCE_API_SECRET`. Restart the backend so the connector reads the values.
  4. In the app, go to `Settings → Trading → Account Modes`, enable `testnet` or `live`, and confirm the exchange name shown for that mode matches your account.

## How do I use test money and see how it works?

1. Paper trading (instant fills, full simulation) is always available on the `Trading` page’s `Paper` tab. Use the Guided Trading Flow to submit practice orders and review fills in the `Order Blotter` and `Fills Feed`.
2. To practice against Binance’s sandbox, enable the `Testnet` tab:
   - Ensure you generated Binance testnet API keys and placed them in your `.env`.
   - Switch to `Trading → Testnet`, then submit orders. You’ll see exchange acknowledgements in the `Alert Stream`.
3. Monitor the effect in `Intraday Cohorts` (testnet runs stream in exactly like live ones) and on the `Analytics → Forecasts` tab to correlate predictions with test fills.

## Does the system pull minute data for the coins? Is the data real?

- On the dashboard’s “Data Bootstrap Controls” card (`Dashboard → Data Bootstrap → Fetch minute-level history` button) you can ingest historical 1 minute, 1 hour, and 1 day candles for the symbols you track. The inventory table highlights which pairs and intervals are already populated.
- Once bootstrapped, the trading UI opens a WebSocket (`Trading` page) and polls every 15–30 seconds elsewhere, so you are seeing live exchange data routed through our backend. Forecast batches refresh automatically every 30 seconds on `Analytics → Forecasts`.

## Are the orders executed by the AI already implemented on the exchanges?

- Orders you see in `Trading → Order Blotter` come from the AI or your manual submissions and are tagged with the active mode (`paper`, `testnet`, or `live`).
- Paper orders stay in the internal simulator. Testnet orders hit the exchange sandbox via ccxt. Live orders only reach the real exchange once you:
  1. Provide exchange API credentials (see above),
  2. Enable the `live` account mode in `Settings → Trading`, and
  3. Either approve the AI’s suggestions via the `Approval Wizard` or allow Auto Mode to trade live (toggle in `Settings → Trading → Auto Mode`).
- The `Fills Feed` and `Alert Stream` on the Trading page confirm when an exchange acknowledges execution, and the `Positions` table reflects open exposure.

## I already have money in Binance—what are my next steps?

1. Secure your Binance login with hardware/2FA.
2. Create a **new** API key with trading permissions (no withdrawals) and record the key/secret.
3. Update `.env` (or your secrets manager) with `BINANCE_API_KEY`, `BINANCE_API_SECRET`, and set the `live` mode’s credential env vars if you use custom names; restart the backend.
4. In the UI, open `Settings → Trading`:
   - In `Account Modes`, enable the `live` profile and keep default mode on `paper` until you’re ready.
   - Adjust risk limits (`Max Trade`, `Max Daily Loss`, `Max Open Exposure`) to match the capital you will allocate.
5. When ready, go to `Trading → Live`, arm alerts, and keep the `Kill Switch` card visible so you can pause instantly if needed.

## If I take money out during an operation, what should I do? Will I get notified when an operation completes?

1. Before withdrawing funds from the exchange, arm the `Kill Switch` on the `Trading` page (enter a reason and press `Arm Kill Switch`). That cancels open orders and freezes automation.
2. After adjusting balances externally, refresh the `Trading` page to resync positions. If exposure breaches are detected, they appear in the `Alert Stream`.
3. Notifications:
   - Execution alerts stream into the `Alert Stream` sidebar in real time.
   - The header `Notifications` button opens the log of completed operations—clearing or reviewing them keeps the audit trail tidy.
   - You can add Slack/Telegram/email channels under `Settings → Trading → Trading Settings → Alert Channels` if you want off-platform notifications.

## Do I need accounts in multiple exchanges? How does that work?

- No—start with one exchange. The system ships with three account modes:
  - `paper` (internal simulator),
  - `testnet` (Binance sandbox by default), and
  - `live` (Binance production, disabled until you configure it).
- Each mode has its own risk caps, exchange, and credential slots. You can enable additional exchanges later by editing the mode configuration (via API or backend) to point ccxt at another venue and providing that venue’s API keys.
- Use multiple exchanges only if you need diverse liquidity; otherwise keep the focus on a single venue until the automation proves stable.

