# Next Phases Roadmap

## Executive Summary

Your platform already covers the full Phase 0–6 roadmap and can orchestrate multi-agent experiments, daily learning cycles, and supervised promotion into real trading. To reach your new goals—rapid intraday simulation with multiple agents (10+ agents sharing a configurable bankroll such as $50, $1,000, $10,000, or $100,000), automated daily scoring, and a controlled go-live on the best one-day strategy by Day 3—you mainly need orchestration glue, richer analytics, and stricter risk promotion policies. This document outlines the gaps and a concrete backend + frontend improvement plan to get there.

---

## Phase 1 Progress Snapshot

**Backend & Orchestration**
- ✅ `scripts/run_intraday_cohort.py` now spins up configurable cohorts (bankroll, allocation policy, timeframe window) and tags each run with metadata for downstream automation.
- ✅ `simulator/account.py` models parent wallets, exposure ceilings, and agent ledgers, enabling aggregated drawdown and utilization checks.
- ✅ `manager/experiment_runner.launch_intraday_cohort()` seeds agents from evolution, enforces parent-level risk, persists rich cohort documents, and rehydrates knowledge for follow-up learning cycles.
- ✅ Migration helper `scripts/migrate_intraday_indexes.py` guarantees Mongo indexes for `sim_runs_intraday` and `cohort_summaries`.

**Analytics & Data**
- ✅ `evaluation/metrics.py` computes hourly ROI, utilization, leverage breaches, and confidence scores per agent with cohort-level rollups.
- ✅ Cohort summaries are stored under `cohort_summaries` and surfaced via `GET /api/experiments/cohorts` (pagination + CSV export).
- ✅ Prometheus integration (`monitor/metrics.py`) tracks cohort runtime, failed agents, utilization, and API latency.

**Learning Loop**
- ✅ `run_intraday_learning_cycle()` (learning loop) narrows scopes to short-horizon families and speeds up Bayesian trials.
- ✅ Redis feature cache (`features/cache.py`) reduces repeated 1m/5m feature hydration and is invalidated on cohort completion.

**Promotion Guard Rails**
- ✅ `promote_intraday_candidate()` ranks cohort agents, writes promotion/audit log entries, and updates `TradingSettings` micro-live caps.
- ✅ Trade alerts send Slack/Telegram/email friendly messages for leverage and bankroll utilization breaches.
- 🟡 Day-3 modal wiring + assistant automation still pending UI integration (tracked below).

**Frontend & Assistant**
- ✅ New `/trading/cohorts` dashboard shows bankroll utilisation, cohort ROI, alerts, and agent leaderboard with existing components.
- 🔄 Day-3 promotion modal and assistant quick actions moved to Phase 2A backlog.

**Operational Readiness**
- 🔄 Runbooks / onboarding updates moved to Phase 2A backlog now that UI scope is clearer.

---

## Current Capabilities vs. Requested Outcomes

| Capability | Today | Gap relative to request |
|------------|-------|-------------------------|
| **Multi-agent fake wallet** | Experiment runner (`manager/experiment_runner.py`) can launch dozens of paper accounts using shared data; simulator supports configurable bankroll and risk profiles. | Need preset "intraday synthetic wallet" mode that seeds 30 agents with a configurable shared cap (e.g., $50–$100,000), enforces aggregate exposure, and stores run metadata as a daily cohort. |
| **Daily scoring & leaderboards** | Leaderboards, learning loop, and knowledge base already compute ROI/Sharpe per genome. | Need per-cohort intraday summary (PnL by hour, capital usage, risk breaches) plus explicit Day 1/2/3 tracking, and UI surface. |
| **Auto-learning & improvement** | Learning engine re-trains meta-model, runs Bayesian optimizer, records knowledge. | Need explicit short-horizon reinforcement (high-frequency data refresh, intraday learning cycle) and faster mutation/selection cadence for 1-day horizon.
| **Promotion to live capital** | Evolution/promoter + trading settings support manual or auto promotions with guard rails. | Need Day-3 playbook: micro-live promotion rule with configurable capital slice, and auto rollback after drawdown. |
| **Auto leverage ramp** | Trading settings support leverage tiers and risk manager monitors P&L. | Need policy engine that ties leverage increments to strategy cohort results and timeboxed goals (10-day growth request). |
| **Assistant command "trade $1,000 or a configurable amount for 10 days"** | Assistant can orchestrate learning cycles and auto-mode trades. | Needs new intent handler to spin up the intraday pack, monitor progress, adjust leverage according to plan, and report daily.

---

## Phase 1 – Intraday Cohort Foundations (Weeks 1–2)

**Backend & Orchestration**
- Deliver `scripts/run_intraday_cohort.py` to launch 30 paper accounts from a parent wallet where bankroll is a parameter (default $1,000, supports $50–$100,000). Include CLI/assistant flags for bankroll ceiling, allocation policy (equal, risk-weighted), start/end timestamps, and symbol selection.  
- Extend `simulator/account.py` to track parent wallet equity, configurable aggregate exposure limits, leverage ceilings, and per-agent capital draws with an auditable ledger.  
- Wire `manager/experiment_runner.py` to hydrate 30 strategies from the evolution engine, seed paper accounts with sub-allocations, enforce parent-level margin checks, and tag runs with cohort metadata.  
- Persist cohort metadata in a new `sim_runs_intraday` collection/table (cohort id, bankroll config, genome list, execution window, agent stats, compliance notes) and add migration scripts.

**Analytics & Data**
- Enrich `evaluation/metrics.py` with hourly ROI, realized/unrealized PnL, variance, max drawdown versus parent wallet, bankroll utilization %, leverage breaches, and trade counts per agent.  
- Emit a `cohort_summary` document to Mongo containing computed metrics, bankroll inputs, alerts triggered, and confidence scores; store deep links to agent logs.  
- Publish FastAPI route `GET /api/experiments/cohorts?date=&bankroll=` returning summaries, agent breakdowns, and CSV download URLs; ensure pagination for multi-day history.  
- Instrument Prometheus metrics for cohort runtime, failed agent counts, bankroll utilization, and API latency; wire Grafana panels.

**Learning Loop**
- Introduce an “intraday mode” in `learning/loop.py` that runs every 2–4 hours with configurable lookback windows (e.g., 6/12/24 hours) and only mutates scalper/short-horizon genomes flagged for the cohort.  
- Cache short-horizon features in Redis keyed by market/timeframe; add invalidation hooks on cohort completion or market data refresh.

**Promotion Guard Rails**
- Implement `evolution/promoter.py::promote_intraday_candidate()` selecting the best 24-hour performer by ROI + Sharpe with minimum trade count, slippage tolerance, and liquidity screens; scale allocation as a percentage of the configured bankroll (e.g., 5% min $50).  
- Write outcomes to `promotion_log`, call `TradingSettings` to allocate micro-live budget, and emit audit events for manual approval workflows.  
- Extend `monitor/trade_alerts.py` with cohort-specific alerts (“parent drawdown > X%”, “agent leverage breach”, “bankroll utilization > threshold”) and ensure reconciliation jobs tag cohort trades for daily exports.

**Frontend & Assistant**
- Add `/trading/cohorts` dashboard tab summarizing cohort state: equity curve, bankroll utilization, agent leaderboard, risk gauges, and configurable bankroll badge; reuse `EvolutionLeaderboardTable` with bankroll context and provide agent drilldowns.  
- Defer Day-3 promotion modal, assistant quick actions, emptystate usage, and lint follow-ups to Phase 2A once backend wiring is ready.

**Operational Readiness**
- Defer runbooks and onboarding updates to Phase 2A so they reflect the completed UI and assistant workflows.

---

## Phase 2A – Intraday UI & Assistant Completion (Weeks 3–4) ✅ COMPLETED

**Frontend & Assistant** ✅
- ✅ Wired the Day-3 promotion modal (`DayThreePromotionModal.tsx`) on `/trading` that surfaces bankroll-aware risk metrics, compliance checklist items, approval notes, and integrates with promotion guard rails before enabling Promote.  
- ✅ Finished assistant automation for Day-3 by adding quick actions ("Start intraday cohort", "Review Day-3 promotion") in `QuickActions.tsx` that call backend routes, allow bankroll input, and work seamlessly with assistant workflows.  
- ✅ Cohort dashboards (`/trading/cohorts`) now reflect parent drawdown, leverage breaches, and bankroll utilisation badges with real-time updates.  
- ✅ EmptyState and ProgressIndicator components integrated throughout cohort dashboards for better UX.
- ✅ All linting and TypeScript errors resolved across frontend files.

**Assistant & API Experience** ✅
- ✅ Exposed lightweight assistant endpoints in `api/routes/assistant.py`:
  - `GET /api/assistant/cohorts/status` - Polls recent cohort status
  - `GET /api/assistant/cohorts/{cohort_id}/promotion-readiness` - Checks Day-3 readiness
  - `GET /api/assistant/cohorts/bankroll-summary` - Summarizes 7-day bankroll usage
- ✅ QuickActions component integrated with these endpoints for real-time assistant narratives
- ✅ Toast notifications and alerts provide interim narratives about cohort performance, risk alerts, and approval blockers

**Operational Readiness** ✅
- ✅ Comprehensive runbook created (`docs/runbook_phase2a.md`) covering:
  - Cohort launch procedures (UI, API, scripts)
  - Monitoring dashboards and key metrics
  - Day-3 promotion step-by-step process
  - Rollback procedures (manual and future automated)
  - Troubleshooting guide with common issues
  - API reference documentation
- ✅ Onboarding guidance included for validating credentials, bankroll parameters, and assistant commands
- ✅ Frontend fully adapted with proper TypeScript types (`types/cohorts.ts`)

**Testing & Observability** ✅
- ✅ Expanded pytest coverage in `tests/test_phase2a_cohort_promotion.py` with 25+ test cases covering:
  - Cohort launch payload validation
  - Promotion guard rail evaluation logic
  - Day-3 promotion flows (pass/fail scenarios)
  - Assistant endpoint functionality
  - Serialization and datetime handling
  - Edge cases (empty agents, high drawdown, etc.)
- ✅ Added comprehensive Playwright tests in `playwright/cohorts.spec.ts`:
  - Cohort dashboard navigation and rendering
  - Empty state handling
  - Cohort selection and detail views
  - Date filtering and pagination
  - Day-3 promotion modal workflows
  - Guard rail checks visualization
  - Assistant quick actions integration
- ✅ Prometheus/Grafana metrics verified for cohort runtime, failed agents, bankroll utilization, and API latency

**Summary:**
Phase 2A is fully complete. Operators can now launch intraday cohorts via the assistant, monitor performance in real-time, and execute Day-3 promotions through a guided modal with comprehensive guard rails. All code is tested, documented, and production-ready.

---

## Phase 2B – Adaptive Risk & Intent Automation (Weeks 4–5)

**Risk & Capital Management**
- Build `trading/bankroll_manager.py` to orchestrate shared capital pools: parameterize bankroll caps per cohort, enforce aggregate exposure by market, and dynamically resize allocations when bankroll inputs change.  
- Implement `risk/policy_engine.py` to ingest cohort summaries, compute rolling Sharpe/drawdown, and adjust leverage tiers per policy (start 2×, step +1× when Sharpe > 1.5 & drawdown < 3%, cap 10×, auto-step-down on losses); persist rationale for audits.  
- Extend Celery (or scheduler) with Day-3 go/no-go pipeline: compile eligible cohorts, request human approval, and trigger micro-live deployment using bankroll-aware slices with automatic rollback timers.

**Assistant & API Experience**
- Introduce intents “Grow $X over 10 (x days - should be a user input on the frontend - assistant) days” (bankroll is user input) to validate prerequisites, spin up cohorts, and generate daily plans (expected return, leverage, bankroll at risk).  
- Add “What should I fund tomorrow?” intent summarizing cohort outcomes, recommending bankroll adjustments, and highlighting pending approvals; log narratives into the knowledge base.  
- Expose `POST /api/assistant/intents/grow` and supporting endpoints with schema validation for bankroll, leverage, and timeframe inputs.

**Frontend Enhancements**
- Extend `/knowledge` to display intraday cohort history, bankroll inputs, Day-3 decisions, leverage adjustments, and assistant recommendations; enable CSV/PDF export with bankroll columns.  
- Add `/risk/leverage` panel showing current tier, next planned tier, triggers, bankroll at risk, and rollback status; include audit log viewer for policy decisions.  
- Update `GuidedTradingFlow` with an intraday cohort option, explaining bankroll flexibility, agent count, and reporting cadence for Easy/Advanced modes.

**Testing & Observability**
- Expand pytest coverage for bankroll manager, policy engine scenarios, assistant intents, and API contracts; include parameterized tests for bankroll variations (e.g., $50 vs. $100,000).  
- Extend Playwright coverage for leverage ramp visualization, knowledge/risk panels, and assistant growth intent workflows.  
- Bolster monitoring dashboards with leverage tier changes, bankroll utilization heatmaps, and promotion outcomes; add alert thresholds for scheduler failures.

---

## Phase 3A – Scalable Automation (Weeks 6–7)

**Automation Maturity**
- Finalize promotion/rollback automation: auto-schedule Day-3 reviews, send bankroll-aware notifications to Slack/Telegram, execute micro-live orders when approved, and auto-rollback on drawdown/variance breaches.  
- Integrate reconciliation pipeline with cohort metadata so finance reports capture bankroll inputs, capital usage, and PnL attribution per agent.

**Operational Safeguards**
- Ensure promotion automation respects policy engine outputs, with explicit rollback timers and human override logging.  
- Backfill historical cohort data into reconciliation reports to validate automation accuracy before full launch.

## Phase 3B – Reporting & Resilience (Weeks 7–8)

**Reporting & Compliance**
- Deliver advanced reporting exports (CSV/PDF) with hourly breakdowns, leverage decisions, bankroll trends, compliance notes, and assistant commentary; provide scheduling hooks for daily delivery.  
- Implement configurable approval chains (ops + risk) with signatures/time stamps, plus audit dashboards summarizing bankroll decisions, leverage changes, and rollback incidents.

**Resilience & Performance**
- Stress-test Redis caching, API throughput, and cohort runner concurrency; define autoscaling thresholds and failover plans.  
- Document disaster recovery steps for bankroll manager and promotion automation, including manual override procedures.

---

## Phase 4A – Advanced Intelligence (Weeks 9–10)

- Integrate reinforcement learning layer atop the Bayesian optimizer to adjust agent weights from cohort feedback in near real time.  
- Implement self-tuning bankroll allocation that redistributes capital across cohorts based on expected utility, risk appetite, and leverage policy outcomes.

## Phase 4B – Compliance & Autonomy Hardening (Weeks 10+)

- Expand compliance tooling with deeper analytics, templated reconciliations, configurable retention policies, and multi-region support.  
- Prepare for production-grade autonomy by adding hard capital stops per day, mandatory human review logs, richer alert routing, and post-mortem automation for incident response.

---

## Testing & Observability Plan

- Expand the pytest suite to cover new cohort metrics, leverage policies, and bankroll manager logic.  
- Add Playwright journeys for the cohort dashboard, Day-3 promotion approval, and assistant intent workflows.  
- Instrument cohort runs with Prometheus/Grafana dashboards (CPU, latency, success rates) so operators see the impact in real time.

---

## Final Notes

- You already have most building blocks; focus on orchestration, analytics, and safety.  
- Always start new strategies in paper/testnet, even after Day-3 promotion, and log all leverage decisions.  
- Use the assistant as a command center: expose new intents and ensure it narrates every major step so non-technical stakeholders can follow along.
