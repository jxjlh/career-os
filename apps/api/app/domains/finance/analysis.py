from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from app.domains.finance.market_data import MarketQuote

MAX_QUOTE_AGE = timedelta(hours=36)
TRADE_ACTIONS = {"build_position", "add_position", "reduce_risk", "rebalance", "exit_review"}


@dataclass(frozen=True)
class AnalysisPosition:
    id: str
    account_id: str
    instrument_id: str
    asset_class: str
    currency: str
    quantity: Decimal
    market_value: Decimal


@dataclass(frozen=True)
class AnalysisCandidate:
    id: str
    instrument_id: str
    asset_class: str
    currency: str
    is_active: bool
    research_status: str
    alert_eligible: bool
    target_allocation_min: Decimal | None
    target_allocation_max: Decimal | None
    allocation_gap: dict[str, Any]


@dataclass(frozen=True)
class RuleRecommendation:
    action: str
    title: str
    instrument_id: str
    candidate_id: str | None
    suggested_allocation_min: Decimal | None
    suggested_allocation_max: Decimal | None
    evidence: list[dict[str, str]]
    counterevidence: list[dict[str, str]]
    confidence: str = "medium"


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _evidence(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def _decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _target_for_asset(profile: Any, asset_class: str) -> Decimal:
    target_allocation = getattr(profile, "target_allocation", {}) or {}
    return _decimal(target_allocation.get(asset_class))


def _candidate_target(profile: Any, candidate: AnalysisCandidate) -> Decimal:
    return candidate.target_allocation_max or candidate.target_allocation_min or _target_for_asset(profile, candidate.asset_class)


def _has_high_overlap(candidate: AnalysisCandidate) -> bool:
    overlap = candidate.allocation_gap.get("overlap") or candidate.allocation_gap.get("overlap_risk")
    return str(overlap).lower() in {"high", "true", "1"}


def quotes_are_fresh(quotes: dict[str, MarketQuote], required_ids: Iterable[str], now: datetime) -> bool:
    expected = set(required_ids)
    if not expected:
        return True
    if not quotes or not expected.issubset(quotes):
        return False
    return all(_utc(quotes[instrument_id].as_of) >= _utc(now) - MAX_QUOTE_AGE for instrument_id in expected)


def evaluate_portfolio(
    profile: Any,
    positions: list[AnalysisPosition],
    candidates: list[AnalysisCandidate],
    quotes: dict[str, MarketQuote],
    now: datetime,
) -> list[RuleRecommendation]:
    """Return deterministic, explainable rule drafts only when all data is fresh.

    These rules do not execute trades.  An entry requires at least two independent
    affirmative checks beyond product eligibility; absent, stale, or mismatched
    market data suppresses every trade-condition card.
    """
    active_positions = [position for position in positions if position.asset_class != "cash" and position.quantity > 0]
    eligible_candidates = [candidate for candidate in candidates if candidate.alert_eligible and candidate.research_status == "ready"]
    required_quote_ids = [position.instrument_id for position in active_positions] + [candidate.instrument_id for candidate in eligible_candidates]
    if not quotes_are_fresh(quotes, required_quote_ids, now):
        return []
    base_currency = getattr(profile, "base_currency", "CNY")
    if any(quotes[item_id].currency != base_currency for item_id in required_quote_ids):
        return []

    total_value = sum((position.market_value for position in positions if position.market_value > 0), Decimal("0"))
    if total_value <= 0:
        return []
    by_instrument: dict[str, Decimal] = {}
    by_asset: dict[str, Decimal] = {}
    cash_value = Decimal("0")
    for position in positions:
        value = max(position.market_value, Decimal("0"))
        by_instrument[position.instrument_id] = by_instrument.get(position.instrument_id, Decimal("0")) + value
        by_asset[position.asset_class] = by_asset.get(position.asset_class, Decimal("0")) + value
        if position.asset_class == "cash":
            cash_value += value
    configured_cash_ratio = _decimal((getattr(profile, "alert_settings", {}) or {}).get("available_cash_ratio"))
    cash_ratio = max(cash_value / total_value, configured_cash_ratio)
    reserve_ratio = _decimal(getattr(profile, "reserve_cash_ratio", Decimal("0")))
    max_concentration = _decimal(getattr(profile, "max_instrument_concentration", Decimal("1")), Decimal("1"))
    max_drawdown = _decimal(getattr(profile, "max_instrument_drawdown", Decimal("1")), Decimal("1"))
    results: list[RuleRecommendation] = []

    for position in active_positions:
        current_ratio = by_instrument.get(position.instrument_id, Decimal("0")) / total_value
        quote = quotes[position.instrument_id]
        evidence: list[dict[str, str]] = []
        if current_ratio > max_concentration:
            evidence.append(_evidence("concentration_limit_exceeded", "单一标的占比超过已设置的集中度上限。"))
            results.append(
                RuleRecommendation(
                    action="reduce_risk",
                    title="复核单一标的集中度",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=None,
                    suggested_allocation_max=max_concentration,
                    evidence=evidence,
                    counterevidence=[],
                    confidence="high",
                )
            )
            continue
        asset_target = _target_for_asset(profile, position.asset_class)
        if asset_target and current_ratio > asset_target + Decimal("0.05"):
            results.append(
                RuleRecommendation(
                    action="rebalance",
                    title="复核目标配置偏离",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=None,
                    suggested_allocation_max=asset_target,
                    evidence=[_evidence("above_target_allocation", "当前占比高于目标配置区间。")],
                    counterevidence=[],
                )
            )
        if quote.drawdown is not None and quote.drawdown <= -max_drawdown and quote.trend == "down":
            results.append(
                RuleRecommendation(
                    action="exit_review",
                    title="复核止损/退出条件",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=None,
                    suggested_allocation_max=None,
                    evidence=[_evidence("drawdown_limit_exceeded", "回撤达到个人设置阈值且趋势仍向下。")],
                    counterevidence=[],
                    confidence="high",
                )
            )

    for candidate in eligible_candidates:
        target_ratio = _candidate_target(profile, candidate)
        if target_ratio <= 0 or not candidate.is_active:
            continue
        current_ratio = by_instrument.get(candidate.instrument_id, Decimal("0")) / total_value
        quote = quotes[candidate.instrument_id]
        evidence: list[dict[str, str]] = []
        if current_ratio < target_ratio:
            evidence.append(_evidence("under_target_allocation", "该标的当前配置低于已确认的目标区间。"))
        if cash_ratio >= reserve_ratio:
            evidence.append(_evidence("cash_reserve_met", "可用现金比例满足预留现金要求。"))
        if quote.valuation_band == "low" or quote.trend == "stable":
            evidence.append(_evidence("favorable_valuation", "行情数据满足预设估值或趋势条件。"))
        if not _has_high_overlap(candidate) and current_ratio < max_concentration:
            evidence.append(_evidence("concentration_and_overlap_ok", "未触发集中度或重叠风险限制。"))
        if len(evidence) < 2:
            continue
        action = "add_position" if current_ratio > 0 else "build_position"
        results.append(
            RuleRecommendation(
                action=action,
                title="复核候选标的建仓条件" if action == "build_position" else "复核候选标的加仓条件",
                instrument_id=candidate.instrument_id,
                candidate_id=candidate.id,
                suggested_allocation_min=candidate.target_allocation_min,
                suggested_allocation_max=candidate.target_allocation_max or target_ratio,
                evidence=evidence,
                counterevidence=[],
            )
        )
    priority = {"reduce_risk": 0, "exit_review": 1, "rebalance": 2, "add_position": 3, "build_position": 4}
    return sorted(results, key=lambda result: (priority[result.action], result.instrument_id))
