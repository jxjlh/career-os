# Personal Finance Module Design

## Goal

Add a Personal Finance module to Career OS for multi-market fund and equity holding management. It helps the user understand portfolio risk, asset allocation, and rule-based buy, add, reduce, and review conditions. It is a decision-support product, not an automated trading system.

## Confirmed Product Decisions

- Support mainland public funds, exchange-traded funds, Hong Kong securities, US securities, and a future direct-stock entry.
- Import holdings from screenshots through OCR. Show extracted data for confirmation, then delete the source image and temporary OCR text immediately.
- Support manual creation, correction, deletion, and transaction recording after import.
- Let the user change risk preference at any time and configure target allocation, cash reserve, position limits, maximum drawdown, and base currency.
- Run daily market and holding analysis after each supported market closes.
- Display in-app notifications only on the Personal Finance home page as actionable cards.
- Never store brokerage credentials, place orders, or execute trades automatically.

## Scope

### First Release

1. Personal Finance home page with total assets, allocation, holdings, pending actions, and market summary.
2. Holding accounts, instruments, transactions, manual maintenance, and screenshot OCR confirmation flow.
3. Candidate pool for user-approved funds and future stocks.
4. Rule-driven portfolio analysis with AI explanations.
5. Daily snapshots, analysis runs, and in-page actionable notification cards.
6. Multi-currency display for CNY, HKD, and USD with a configurable base currency.

### Explicit Non-Goals

- Broker login, account credential storage, automatic order placement, or trade execution.
- Guaranteed returns, black-box buy/sell directives, or recommendations based only on a single-day move or news article.
- Persistent storage of raw holding screenshots or unconfirmed OCR content.
- Household/shared ledgers in the first release.

## Information Architecture

Add a `Personal Finance` entry to the app navigation.

### Home

- Asset header: total assets, day change, cumulative profit/loss, cash ratio, and base-currency conversion.
- Today action cards: build a first position, add, pause buying, rebalance, reduce risk, or review fund quality.
- Market and portfolio summary: mainland, Hong Kong, and US market sections plus actual impact on the user portfolio.
- Holdings preview: funds, ETFs, stocks, and cash grouped by asset class, market, account, and return.
- Import and maintenance controls: screenshot import, manual holding entry, manual transaction entry, and data correction.

### Subpages

- `Holdings`: accounts, instruments, positions, allocation, cost, market value, and profit/loss.
- `Candidate Pool`: user-approved instruments, suitability reason, target allocation, and observation conditions.
- `Transactions`: confirmed OCR imports, manual buys/sells, corrections, and audit history.
- `Strategy & Risk`: risk preference, target allocation, cash reserve, concentration limits, maximum drawdown, and alert preferences.
- `Instrument Detail`: holding thesis, target range, current risk, recommendation history, evidence, counterevidence, and review timeline.

## Data Model

### FinanceProfile

One profile per user. Stores risk preference, base currency, target allocation, reserve cash ratio, instrument concentration limits, maximum portfolio and instrument drawdown, investment horizon, and alert settings.

### FinanceAccount

Represents a manual, fund-platform, or broker account. Stores display name, market, currency, and account type only; no credentials.

### FinancialInstrument

Canonical catalog record for a fund, ETF, stock, cash-equivalent, or other supported instrument. Stores market, currency, asset class, product type, identifier, benchmark, and data-provider mapping.

### FinanceTransaction

Immutable confirmed event: buy, sell, dividend, fee, deposit, withdrawal, position correction, or import correction. Stores quantity, price, fee, currency, occurred date, source, and notes.

### FinancePosition

Materialized current position derived from transactions and manual corrections. Stores quantity, average cost, market value, unrealized profit/loss, target allocation, and most recent valuation timestamp.

### FinanceCandidate

User-approved fund or stock under observation. Stores suitability reason, intended asset-allocation gap, target allocation range, research status, and alert eligibility.

### FinanceSnapshot

Daily portfolio and instrument valuation snapshot. Stores prices, FX rates, allocation, return, drawdown, concentration, and data freshness.

### FinanceAnalysisRun and FinanceRecommendation

Each daily run stores the inputs, rule results, source timestamps, and generated explanation. Each recommendation stores the action, suggested allocation range, evidence, counterevidence, confidence, expiry, user disposition, and linked rule triggers.

### FinanceImport

Tracks screenshot import status and structured extraction result only. The original file reference and raw OCR text are deleted after the user confirms or discards the import.

## Screenshot OCR Flow

1. Upload screenshot to temporary processing storage.
2. Extract account, instrument name/code, quantity, cost, market value, profit/loss, currency, and snapshot date.
3. Classify each row as new, update, duplicate, or low-confidence.
4. Let the user edit and confirm the structured result.
5. Create finance transactions and update positions only after confirmation.
6. Delete the source image and temporary extraction text; retain only the confirmed structured records and import audit metadata.

## Recommendation Engine

The engine has a deterministic rule layer and an AI explanation layer. The rule layer determines whether an action is eligible; AI explains the result in clear language and cannot override the rules.

### Candidate Selection

Candidate scoring considers asset-allocation gaps, region and currency diversification, overlap with existing holdings, risk compatibility, fees, benchmark/style, capacity/liquidity checks, and product-quality metadata. Only instruments in the user-approved candidate pool can receive a buy-condition card.

### Buy and Add Conditions

- Check available cash and user reserve requirements.
- Check whether the instrument or asset class is below its configured target range.
- Reject an action if concentration, overlap, volatility, or product-quality rules fail.
- Require multiple independent market and valuation conditions before enabling a first-position or add-position recommendation.
- Convert the result into staged allocation ranges rather than a single all-in amount.
- Output one of: observe, eligible for first position, eligible for next staged add, or pause buying.

### Reduce and Sell Conditions

- Rebalance when an instrument or asset class exceeds the configured target range.
- Flag concentration or drawdown threshold breaches.
- Flag product-quality changes such as style drift, manager/strategy changes, or persistent benchmark-relative weakness where data is available.
- Reduce risk as a user-defined financial goal approaches its required cash date.
- Output one of: hold, review, rebalance, reduce risk, or exit-for-review. The user performs the actual trade manually.

### Explainability

Every recommendation must show the action, suggested allocation range, trigger values, data timestamp, supporting evidence, counterevidence, expiry, and the next review condition. Market news may add context but cannot be the only trigger.

## Daily Automation and Notifications

- Use timezone-aware post-close schedules for mainland China, Hong Kong, and US markets.
- Fetch market, fund, and FX data through provider adapters. If data is stale or unavailable, record the problem and suppress trading-condition recommendations.
- Recalculate snapshots, allocation, drawdown, instrument quality checks, and rules after data is available.
- Generate or update notification cards only on the Personal Finance home page.
- Merge identical unresolved cards to avoid repetitive notifications.
- Keep a daily review record containing market status, portfolio change, triggered rules, suppressed recommendations, and source timestamps.

## APIs

All routes are under `/api/v1/finance`.

- `GET/PATCH /profile`
- `GET/POST/PATCH/DELETE /accounts`
- `GET /instruments/search`
- `GET/POST/PATCH/DELETE /candidates`
- `GET/POST/PATCH/DELETE /transactions`
- `GET/POST/PATCH/DELETE /positions`
- `POST /imports/screenshot`
- `GET/PATCH /imports/{id}`
- `POST /imports/{id}/confirm`
- `POST /imports/{id}/discard`
- `GET /dashboard`
- `GET /analysis/latest`
- `GET /recommendations`
- `POST /recommendations/{id}/dismiss`
- `POST /analysis/run` for authorized manual refresh and scheduled jobs

## Security and Reliability

- Require authenticated ownership checks on every account, position, import, transaction, and recommendation.
- Store no raw brokerage credentials.
- Delete temporary screenshot and OCR artifacts on confirmation, discard, timeout, and failure cleanup.
- Use idempotency keys and duplicate detection for confirmed imports.
- Preserve manual transaction history; scheduled analysis cannot overwrite user-entered data.
- Validate numeric ranges, market/currency compatibility, and import confidence before writes.

## Acceptance Criteria

1. A user can create and edit a risk profile and investment limits.
2. A user can upload a holding screenshot, correct its extraction, confirm it, and verify that the original is deleted.
3. A user can manually maintain accounts, positions, and transactions.
4. The dashboard calculates allocation, concentration, cost, return, drawdown, and base-currency totals.
5. A candidate fund can receive observe, first-position, add, pause, or rebalance/reduce conditions with visible evidence and counterevidence.
6. A daily run records data freshness and creates only relevant, deduplicated home-page cards.
7. Data-source failure prevents new buy/sell condition cards and is visible to the user.
8. Automated analysis never places an order or modifies confirmed transactions.

## Delivery Sequence

1. Data schema, finance API, manual holdings and transactions, and Personal Finance dashboard.
2. Screenshot OCR temporary-processing and confirmation workflow.
3. Candidate pool, deterministic recommendation rules, and AI explanations.
4. Scheduled analysis, market/FX adapters, notifications, and history/review views.
