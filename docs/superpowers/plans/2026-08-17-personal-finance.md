# Personal Finance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure personal-finance workspace for confirmed fund, ETF, and stock holdings, with screenshot-to-confirmation import, manual maintenance, explainable analysis, and daily in-app action cards.

**Architecture:** Add a user-scoped FastAPI `finance` domain with SQLAlchemy models, service/repository boundaries, provider protocols for OCR and market data, and a deterministic rule engine. Add a Next.js `/finance` route using React Query and the existing card/chart primitives. Scheduled GitHub Actions calls an authenticated analysis endpoint; no API process-local scheduler is used.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, Decimal, httpx, pytest, Next.js 15, React 19, TanStack React Query, ECharts, GitHub Actions, Render, Supabase Storage.

## Global Constraints

- Create an isolated worktree from `master` before implementation; do not stage the primary worktree's unrelated changes.
- All data queries must include the authenticated user ID; foreign IDs from another user return `404`.
- Store monetary values with `Decimal`, serialize them as strings, and round only in frontend display code.
- Never persist broker credentials, execute an order, or allow AI to create an action absent from deterministic rules.
- Delete temporary screenshots and raw OCR text on confirmation, discard, expiry cleanup, or permanent OCR failure; retain only confirmed rows and import audit metadata.
- Suppress buy, add, reduce, and sell-condition cards when market/FX data is missing or stale.
- Manual transactions are immutable business events; scheduled analysis may create snapshots and recommendations only.
- Production requires `FINANCE_MARKET_DATA_BASE_URL`, `FINANCE_MARKET_DATA_API_KEY`, `FINANCE_OCR_API_URL`, `FINANCE_OCR_API_KEY`, and matching GitHub/Render `FINANCE_SCHEDULER_TOKEN` values. Missing provider configuration leaves manual maintenance usable and reports an explicit unavailable state.

---

## File Structure

- `apps/api/app/db/models.py`: finance models and database constraints.
- `apps/api/migrations/versions/20260817_add_personal_finance.py`: PostgreSQL/SQLite migration.
- `apps/api/app/domains/finance/{schemas,repository,market_data,ocr,analysis,service,router}.py`: finance API and domain logic.
- `apps/api/app/main.py`, `apps/api/app/core/config.py`, `apps/api/.env.example`: route registration and configuration.
- `apps/api/tests/test_finance_{schema,crud,dashboard,imports,analysis,scheduler}.py`: API regression coverage.
- `apps/web/app/(app)/finance/page.tsx`: Finance route.
- `apps/web/lib/finance.ts`: typed API client and React Query keys.
- `apps/web/components/finance/{finance-dashboard,holding-table,import-holdings-dialog,manual-transaction-dialog,candidate-pool,risk-settings-form,recommendation-card}.tsx`: focused UI units.
- `apps/web/components/sidebar/sidebar-nav.tsx`, `apps/web/components/command-palette.tsx`, `apps/web/lib/i18n.tsx`, `apps/web/app/manifest.ts`: discovery/navigation.
- `.github/workflows/finance-analysis.yml`: daily authenticated analysis trigger.

---

### Task 1: Create the Finance Schema and Migration

**Files:**
- Modify: `apps/api/app/db/models.py`
- Create: `apps/api/migrations/versions/20260817_add_personal_finance.py`
- Create: `apps/api/tests/test_finance_schema.py`

**Interfaces:**
- Produces `FinanceProfile`, `FinanceAccount`, `FinancialInstrument`, `FinanceTransaction`, `FinancePosition`, `FinanceCandidate`, `FinanceImport`, `FinanceSnapshot`, `FinanceAnalysisRun`, and `FinanceRecommendation`.
- Produces unique constraints `uq_finance_profile_user`, `uq_finance_account_user_name`, and `uq_finance_instrument_market_symbol`.

- [ ] **Step 1: Write failing schema tests**

```python
def test_finance_profile_is_unique_per_user(db, user):
    db.add(FinanceProfile(user_id=user.id))
    db.commit()
    db.add(FinanceProfile(user_id=user.id))
    with pytest.raises(IntegrityError):
        db.commit()


def test_transaction_links_user_account_and_instrument(db, user):
    account = FinanceAccount(user_id=user.id, name="基金账户", market="CN", currency="CNY")
    instrument = FinancialInstrument(market="CN", symbol="110011", name="示例基金", asset_class="fund", currency="CNY")
    db.add_all([account, instrument])
    db.commit()
    transaction = FinanceTransaction(user_id=user.id, account_id=account.id, instrument_id=instrument.id,
        transaction_type="buy", quantity=Decimal("10"), unit_price=Decimal("1.2"), fee=Decimal("0"), currency="CNY", occurred_on=date(2026, 8, 17), source="manual")
    db.add(transaction)
    db.commit()
    assert transaction.user_id == user.id
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && uv run pytest -q tests/test_finance_schema.py`

Expected: FAIL because finance models do not exist.

- [ ] **Step 3: Implement models and migration**

```python
class FinanceProfile(Base):
    __tablename__ = "finance_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_finance_profile_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    risk_preference: Mapped[str] = mapped_column(String(16), default="balanced")
    base_currency: Mapped[str] = mapped_column(String(3), default="CNY")
    target_allocation: Mapped[dict] = mapped_column(JSON, default=dict)
    reserve_cash_ratio: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0.10"))
```

Create the nine remaining tables with user-scoped indexes, UTC timestamps, `Numeric(20, 8)` quantities/prices, `Numeric(20, 4)` valuations, and `JSON` evidence fields. The Alembic migration must create tables in dependency order and drop them in reverse order.

- [ ] **Step 4: Run schema validation**

Run:

```bash
cd apps/api
uv run pytest -q tests/test_finance_schema.py
uv run alembic upgrade head
```

Expected: tests pass and the migration applies without touching unrelated tables.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/db/models.py apps/api/migrations/versions/20260817_add_personal_finance.py apps/api/tests/test_finance_schema.py
git commit -m "feat: add personal finance schema"
```

### Task 2: Deliver User-Scoped Portfolio CRUD and Dashboard API

**Files:**
- Create: `apps/api/app/domains/finance/__init__.py`
- Create: `apps/api/app/domains/finance/schemas.py`
- Create: `apps/api/app/domains/finance/repository.py`
- Create: `apps/api/app/domains/finance/service.py`
- Create: `apps/api/app/domains/finance/router.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_finance_crud.py`
- Create: `apps/api/tests/test_finance_dashboard.py`

**Interfaces:**
- Produces `GET/PATCH /finance/profile`, CRUD at `/finance/accounts`, `/finance/transactions`, `/finance/candidates`, `GET /finance/instruments/search`, and `GET /finance/dashboard`.
- Produces `FinanceService.apply_transaction(user_id, payload)` and `FinanceService.build_dashboard(user_id)`.

- [ ] **Step 1: Write failing API tests**

```python
def test_finance_profile_account_and_transaction_flow(client, headers):
    profile = client.patch("/api/v1/finance/profile", headers=headers, json={
        "riskPreference": "balanced", "baseCurrency": "CNY", "reserveCashRatio": "0.15",
        "targetAllocation": {"fund": "0.60", "stock": "0.20", "cash": "0.20"},
    })
    assert profile.status_code == 200
    account = client.post("/api/v1/finance/accounts", headers=headers,
        json={"name": "天天基金", "market": "CN", "currency": "CNY", "accountType": "fund"})
    transaction = client.post("/api/v1/finance/transactions", headers=headers, json={
        "accountId": account.json()["data"]["id"],
        "instrument": {"market": "CN", "symbol": "110011", "name": "示例基金", "assetClass": "fund", "currency": "CNY"},
        "transactionType": "buy", "quantity": "100", "unitPrice": "1.2", "fee": "0", "occurredOn": "2026-08-17",
    })
    assert transaction.status_code == 201
    assert client.get("/api/v1/finance/dashboard", headers=headers).status_code == 200
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && uv run pytest -q tests/test_finance_crud.py tests/test_finance_dashboard.py`

Expected: FAIL with `404` before router registration.

- [ ] **Step 3: Implement validated requests, repository, and service**

```python
class FinanceProfilePatch(BaseModel):
    risk_preference: Literal["conservative", "balanced", "aggressive"]
    base_currency: Literal["CNY", "HKD", "USD"]
    reserve_cash_ratio: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    target_allocation: dict[str, Decimal]


@router.post("/finance/transactions", status_code=201)
def create_transaction(payload: FinanceTransactionCreate, current_user: CurrentUser, db: DbSession) -> dict:
    transaction = FinanceService(db).apply_transaction(current_user.id, payload)
    return {"data": serialize_transaction(transaction)}
```

Validate market/currency/asset-class combinations, update only the materialized `FinancePosition` through `apply_transaction`, return 404 for unowned resources, and serialize `Decimal` as strings.

- [ ] **Step 4: Run focused tests**

Run: `cd apps/api && uv run pytest -q tests/test_finance_crud.py tests/test_finance_dashboard.py`

Expected: CRUD, dashboard aggregation, and cross-user 404 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/domains/finance apps/api/app/main.py apps/api/tests/test_finance_crud.py apps/api/tests/test_finance_dashboard.py
git commit -m "feat: add personal finance portfolio APIs"
```

### Task 3: Add Market Data, Rule-Based Analysis, and Daily Run API

**Files:**
- Create: `apps/api/app/domains/finance/market_data.py`
- Create: `apps/api/app/domains/finance/analysis.py`
- Modify: `apps/api/app/domains/finance/service.py`
- Modify: `apps/api/app/domains/finance/router.py`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/.env.example`
- Create: `apps/api/tests/test_finance_analysis.py`

**Interfaces:**
- Produces `MarketQuote`, `MarketDataProvider`, and `evaluate_portfolio(profile, positions, candidates, quotes, now)`.
- Produces `POST /finance/analysis/run`, `GET /finance/analysis/latest`, `GET /finance/recommendations`, and `POST /finance/recommendations/{id}/dismiss`.

- [ ] **Step 1: Write failing rule tests**

```python
def test_underweight_candidate_requires_multiple_conditions():
    result = evaluate_portfolio(profile=profile(reserve_cash_ratio="0.10"), positions=[cash_position("0.40")],
        candidates=[candidate("110011", target_ratio="0.15")],
        quotes={"110011": fresh_quote("1.20", valuation_band="low", trend="stable")}, now=UTC_NOW)
    assert result[0].action == "build_position"
    assert "under_target_allocation" in result[0].evidence


def test_stale_data_creates_no_trade_condition():
    assert evaluate_portfolio(profile=profile(), positions=[fund_position()], candidates=[], quotes={"110011": stale_quote()}, now=UTC_NOW) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && uv run pytest -q tests/test_finance_analysis.py`

Expected: FAIL because the rule engine does not exist.

- [ ] **Step 3: Implement deterministic gates and provider interface**

```python
@dataclass(frozen=True)
class MarketQuote:
    price: Decimal
    currency: str
    as_of: datetime
    valuation_band: str | None = None
    trend: str | None = None


def evaluate_portfolio(profile, positions, candidates, quotes, now):
    if not quotes_are_fresh(quotes, now):
        return []
    return merge_duplicate_actions([
        *evaluate_risk_limits(profile, positions),
        *evaluate_rebalancing(profile, positions),
        *evaluate_candidate_entries(profile, positions, candidates, quotes),
    ])
```

Require fresh data, reserve cash, allocation gap, concentration/overlap checks, product-quality state, and two independent candidate-entry conditions before `build_position` or `add_position`. Persist evidence, counterevidence, allocation range, expiry, and rule version. AI receives only persisted drafts and returns an explanation; failure falls back to a deterministic template.

- [ ] **Step 4: Run focused analysis tests**

Run: `cd apps/api && uv run pytest -q tests/test_finance_analysis.py tests/test_finance_dashboard.py`

Expected: build/add/pause/rebalance/reduce states are deterministic and stale/missing data produces no action card.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/domains/finance apps/api/app/core/config.py apps/api/.env.example apps/api/tests/test_finance_analysis.py
git commit -m "feat: add personal finance analysis rules"
```

### Task 4: Implement Screenshot OCR Review and Immediate File Deletion

**Files:**
- Create: `apps/api/app/domains/finance/ocr.py`
- Modify: `apps/api/app/domains/finance/{schemas,service,router}.py`
- Modify: `apps/api/app/core/storage.py`
- Create: `apps/api/tests/test_finance_imports.py`

**Interfaces:**
- Produces `POST /finance/imports/screenshot`, `GET/PATCH /finance/imports/{id}`, `POST /finance/imports/{id}/confirm`, and `POST /finance/imports/{id}/discard`.
- Produces `HoldingOcrProvider.extract(image: bytes, content_type: str) -> list[ExtractedHoldingRow]`.

- [ ] **Step 1: Write failing lifecycle tests**

```python
def test_confirmed_import_deletes_temporary_object(client, headers, monkeypatch):
    deleted = []
    monkeypatch.setattr("app.domains.finance.ocr.get_holding_ocr_provider", lambda: FakeOcrProvider.one_fund())
    monkeypatch.setattr("app.domains.finance.service.delete_object", lambda path: deleted.append(path))
    imported = client.post("/api/v1/finance/imports/screenshot", headers=headers,
        files={"file": ("holding.png", b"image", "image/png")})
    confirmed = client.post(f"/api/v1/finance/imports/{imported.json()['data']['id']}/confirm", headers=headers,
        json={"rows": imported.json()["data"]["rows"]})
    assert confirmed.status_code == 200
    assert len(deleted) == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && uv run pytest -q tests/test_finance_imports.py`

Expected: FAIL with missing import route.

- [ ] **Step 3: Implement temporary import lifecycle**

```python
async def confirm_import(import_id: str, user_id: str, rows: list[ImportRowPatch]) -> FinanceImport:
    finance_import = repository.get_owned_import(import_id, user_id)
    validate_confirmed_rows(rows)
    apply_rows_as_transactions(finance_import, rows)
    await delete_object(finance_import.temporary_object_path)
    finance_import.temporary_object_path = None
    finance_import.raw_ocr_text = None
    finance_import.status = "confirmed"
    return finance_import
```

Accept only image MIME types and configured-size uploads. Persist normalized rows and confidence only. On confirm/discard/expiry, delete the temporary object before clearing path/text. Return `OCR_NOT_CONFIGURED` if no provider endpoint is configured and preserve manual transaction entry.

- [ ] **Step 4: Run import tests**

Run: `cd apps/api && uv run pytest -q tests/test_finance_imports.py`

Expected: confirmation, discard, low-confidence, expiry cleanup, and ownership tests pass; each temporary object is deleted exactly once.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/storage.py apps/api/app/domains/finance apps/api/tests/test_finance_imports.py
git commit -m "feat: import personal finance holdings from screenshots"
```

### Task 5: Build the Personal Finance Frontend Workspace

**Files:**
- Create: `apps/web/lib/finance.ts`
- Create: `apps/web/app/(app)/finance/page.tsx`
- Create: `apps/web/components/finance/{finance-dashboard,holding-table,import-holdings-dialog,manual-transaction-dialog,candidate-pool,risk-settings-form,recommendation-card}.tsx`
- Modify: `apps/web/components/sidebar/sidebar-nav.tsx`
- Modify: `apps/web/components/command-palette.tsx`
- Modify: `apps/web/lib/i18n.tsx`
- Modify: `apps/web/app/manifest.ts`

**Interfaces:**
- Consumes all finance API routes from Tasks 2–4.
- Produces typed query keys `financeDashboard`, `financeHoldings`, `financeCandidates`, and `financeRecommendations`.

- [ ] **Step 1: Write frontend API type fixture**

```ts
const fixture: FinanceDashboard = {
  assetSummary: { baseCurrency: "CNY", totalValue: "1000", dayChange: "10", cumulativeReturn: "0.02", cashRatio: "0.2" },
  allocation: [], holdings: [], marketSummaries: [], actionCards: [],
  dataFreshness: { isFresh: true, updatedAt: "2026-08-17T09:30:00Z" },
};
void fixture;
```

- [ ] **Step 2: Run typecheck to verify missing contracts fail**

Run: `npm --workspace apps/web run typecheck`

Expected: FAIL until `FinanceDashboard` and finance API exports exist.

- [ ] **Step 3: Implement route, queries, and focused components**

```tsx
const dashboard = useQuery({ queryKey: financeQueryKeys.dashboard(), queryFn: financeApi.getDashboard });

return <FinanceDashboard data={dashboard.data?.data} isLoading={dashboard.isLoading} />;
```

Use existing `Card`, `Badge`, `Button`, `Skeleton`, `EChart`, and React Query patterns. Add a `个人理财` sidebar/command/PWA entry. Keep all recommendation cards inside `/finance`. Clear the selected `File` from component state after confirmation/discard and invalidate dashboard/holding queries after every confirmed import or manual transaction.

- [ ] **Step 4: Run web validation**

Run:

```bash
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
```

Expected: `/finance` appears in the export output and there are no new TypeScript or lint errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/finance.ts 'apps/web/app/(app)/finance/page.tsx' apps/web/components/finance apps/web/components/sidebar/sidebar-nav.tsx apps/web/components/command-palette.tsx apps/web/lib/i18n.tsx apps/web/app/manifest.ts
git commit -m "feat: add personal finance workspace"
```

### Task 6: Schedule Analysis and Verify Production Release

**Files:**
- Create: `.github/workflows/finance-analysis.yml`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/app/domains/finance/router.py`
- Create: `apps/api/tests/test_finance_scheduler.py`
- Modify: `apps/api/tests/test_api_surface.py`

**Interfaces:**
- Produces scheduler-only authentication using `X-Finance-Scheduler-Token` and a `202` analysis-run response.
- Produces scheduled calls for both mainland/Hong Kong and US market windows.

- [ ] **Step 1: Write failing scheduler authorization test**

```python
def test_scheduled_analysis_requires_private_token(client, monkeypatch):
    monkeypatch.setenv("FINANCE_SCHEDULER_TOKEN", "scheduler-secret")
    assert client.post("/api/v1/finance/analysis/run", json={"scope": "all_markets"}).status_code == 401
    response = client.post("/api/v1/finance/analysis/run", headers={"X-Finance-Scheduler-Token": "scheduler-secret"}, json={"scope": "all_markets"})
    assert response.status_code == 202
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && uv run pytest -q tests/test_finance_scheduler.py`

Expected: FAIL because the scheduler authentication branch is absent.

- [ ] **Step 3: Add secure endpoint and GitHub workflow**

```yaml
name: Run personal finance analysis
on:
  schedule:
    - cron: "30 9 * * 1-5"
    - cron: "30 22 * * 1-5"
  workflow_dispatch:
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - run: >-
          curl --fail-with-body --retry 3 --retry-all-errors
          -H "X-Finance-Scheduler-Token: ${{ secrets.FINANCE_SCHEDULER_TOKEN }}"
          -H "Content-Type: application/json"
          --data '{"scope":"all_markets"}'
          "${{ secrets.FINANCE_ANALYSIS_API_URL }}/api/v1/finance/analysis/run"
```

Use constant-time token comparison, require a non-empty configured secret, and document that the same generated value must be configured as the Render environment variable and GitHub Actions secret before enabling the workflow.

- [ ] **Step 4: Run full validation and rebuild static assets**

Run:

```bash
cd apps/api && uv run pytest -q
cd ../..
rm -rf apps/web/out
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm --workspace apps/web run build
rsync -a --delete apps/web/out/ apps/api/static/
```

Expected: all API tests pass, `/finance` exports, and stale API static assets are removed.

- [ ] **Step 5: Commit and verify release**

```bash
git add .github/workflows/finance-analysis.yml apps/api apps/web apps/api/static
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: deliver personal finance module"
```

Stage only reviewed finance-related files. After the post-commit push, wait for GitHub CI and `Verify Render deployment`; verify `/ready`, `https://ai-life-os-web.onrender.com/health`, the deployed `/finance` route, and an authenticated finance smoke test using a dedicated test account. Record provider configuration as blocked rather than fabricating live market/OCR output if the required credentials are absent.

---

## Plan Self-Review

- Tasks 1–2 cover persistent user-scoped finance data and manual maintenance.
- Task 3 covers market data, explainable action conditions, stale-data suppression, and no-AI-override behavior.
- Task 4 covers screenshot review and immediate deletion.
- Task 5 covers the Personal Finance home page, notifications, holdings, candidates, and risk settings.
- Task 6 covers daily scheduling, secret boundaries, CI/Render release checks, and live verification.
- The plan contains concrete files, test names, signatures, commands, expected outcomes, and scoped commits; no unreviewed primary-worktree changes are included.
