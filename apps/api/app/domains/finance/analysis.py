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
    # 新字段：持仓决策卡增强信息
    suggested_amount_min: Decimal | None = None  # 建议金额（下限），CNY
    suggested_amount_max: Decimal | None = None  # 建议金额（上限），CNY
    position_change_pct: Decimal | None = None  # 建议仓位变化比例（相对总资产），正值加仓，负值减仓
    trigger_reason: str | None = None  # 触发原因（一句话说明为什么建议此动作）
    risk_note: str | None = None  # 风险提示
    source_data: dict[str, Any] | None = None  # 携带当前标的信息供展示（当前仓位、成本、市值、收益等）


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
    cash_positions: list[AnalysisPosition] = []
    for position in positions:
        value = max(position.market_value, Decimal("0"))
        by_instrument[position.instrument_id] = by_instrument.get(position.instrument_id, Decimal("0")) + value
        by_asset[position.asset_class] = by_asset.get(position.asset_class, Decimal("0")) + value
        if position.asset_class == "cash":
            cash_value += value
            cash_positions.append(position)
    configured_cash_ratio = _decimal((getattr(profile, "alert_settings", {}) or {}).get("available_cash_ratio"))
    if cash_value > 0:
        cash_ratio = cash_value / total_value
    elif configured_cash_ratio > 0:
        cash_ratio = configured_cash_ratio
    else:
        cash_ratio = Decimal("0")
    reserve_ratio = _decimal(getattr(profile, "reserve_cash_ratio", Decimal("0")))
    max_concentration = _decimal(getattr(profile, "max_instrument_concentration", Decimal("1")), Decimal("1"))
    max_drawdown = _decimal(getattr(profile, "max_instrument_drawdown", Decimal("1")), Decimal("1"))
    risk_pref = getattr(profile, "risk_preference", "balanced")
    results: list[RuleRecommendation] = []
    triggered_position_ids: set[str] = set()

    for position in active_positions:
        current_ratio = by_instrument.get(position.instrument_id, Decimal("0")) / total_value
        quote = quotes[position.instrument_id]
        current_market_value = position.market_value
        source_payload = {
            "instrumentId": position.instrument_id,
            "accountId": position.account_id,
            "assetClass": position.asset_class,
            "currency": position.currency,
            "quantity": format(position.quantity.normalize(), "f"),
            "currentMarketValue": format(current_market_value.normalize(), "f"),
            "currentAllocationRatio": format(current_ratio.normalize(), "f"),
            "marketPrice": format(quote.price.normalize(), "f"),
            "drawdown": format(quote.drawdown.normalize(), "f") if quote.drawdown is not None else None,
            "trend": quote.trend,
        }
        evidence: list[dict[str, str]] = []
        if current_ratio > max_concentration:
            evidence.append(_evidence("concentration_limit_exceeded", "单一标的占比超过已设置的集中度上限。"))
            current_amount = current_market_value
            target_amount = total_value * max_concentration
            reduce_amount_max = current_amount - target_amount
            reduce_amount_min = reduce_amount_max * Decimal("0.5")
            triggered_position_ids.add(position.instrument_id)
            results.append(
                RuleRecommendation(
                    action="reduce_risk",
                    title="降低单一标的集中度：减仓",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=max_concentration,
                    suggested_allocation_max=max_concentration,
                    suggested_amount_min=reduce_amount_min,
                    suggested_amount_max=reduce_amount_max,
                    position_change_pct=-(current_ratio - max_concentration),
                    trigger_reason=f"当前占比 {format(current_ratio * 100, '.1f')}%，超过已设置的上限 {format(max_concentration * 100, '.1f')}%。",
                    risk_note="集中度过高会放大单一标的回撤风险，分批减仓可降低组合波动。",
                    evidence=evidence,
                    counterevidence=[],
                    confidence="high",
                    source_data=source_payload,
                )
            )
            continue
        asset_target = _target_for_asset(profile, position.asset_class)
        if asset_target and current_ratio > asset_target + Decimal("0.05"):
            current_amount = current_market_value
            target_amount = total_value * asset_target
            rebalance_amount_max = current_amount - target_amount
            rebalance_amount_min = rebalance_amount_max * Decimal("0.5")
            triggered_position_ids.add(position.instrument_id)
            results.append(
                RuleRecommendation(
                    action="rebalance",
                    title="目标配置偏离：建议减仓",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=None,
                    suggested_allocation_max=asset_target,
                    suggested_amount_min=rebalance_amount_min,
                    suggested_amount_max=rebalance_amount_max,
                    position_change_pct=-(current_ratio - asset_target) * Decimal("0.5"),
                    trigger_reason=f"该标的所属品类当前占总资产 {format((by_asset.get(position.asset_class, Decimal('0')) / total_value) * 100, '.1f')}%，高于目标配置 {format(asset_target * 100, '.1f')}%。",
                    risk_note="长期偏离目标配置会改变组合风险特征，建议小步回调。",
                    evidence=[_evidence("above_target_allocation", "当前占比高于目标配置区间。")],
                    counterevidence=[],
                    source_data=source_payload,
                )
            )
        if quote.drawdown is not None and quote.drawdown <= -max_drawdown and quote.trend == "down":
            triggered_position_ids.add(position.instrument_id)
            current_amount = current_market_value
            exit_amount_max = current_amount
            exit_amount_min = current_amount * Decimal("0.3")
            results.append(
                RuleRecommendation(
                    action="exit_review",
                    title="止损条件触发：复核卖出/减仓",
                    instrument_id=position.instrument_id,
                    candidate_id=None,
                    suggested_allocation_min=None,
                    suggested_allocation_max=None,
                    suggested_amount_min=exit_amount_min,
                    suggested_amount_max=exit_amount_max,
                    position_change_pct=-(current_ratio * Decimal("0.5")),
                    trigger_reason=f"标的回撤 {format(abs(quote.drawdown) * 100, '.1f')}%，超过个人设置的 {format(max_drawdown * 100, '.1f')}% 阈值，趋势仍向下。",
                    risk_note="下行趋势下进一步下跌的概率较高，先锁定部分本金或完全退出。",
                    evidence=[_evidence("drawdown_limit_exceeded", "回撤达到个人设置阈值且趋势仍向下。")],
                    counterevidence=[],
                    confidence="high",
                    source_data=source_payload,
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
            evidence.append(_evidence("cash_reserve_met", f"可用现金比例 {format(cash_ratio * 100, '.1f')}%，满足预留现金 {format(reserve_ratio * 100, '.1f')}% 要求。"))
        if quote.valuation_band == "low" or quote.trend == "stable":
            evidence.append(_evidence("favorable_valuation", "行情数据满足预设估值或趋势条件。"))
        if not _has_high_overlap(candidate) and current_ratio < max_concentration:
            evidence.append(_evidence("concentration_and_overlap_ok", "未触发集中度或重叠风险限制。"))
        if len(evidence) < 2:
            continue
        gap = target_ratio - current_ratio
        buy_amount_max = total_value * gap
        if cash_value > 0:
            buy_amount_max = min(buy_amount_max, cash_value * Decimal("0.8"))
        risk_factor = {"conservative": Decimal("0.4"), "balanced": Decimal("0.6"), "aggressive": Decimal("0.8")}.get(risk_pref, Decimal("0.5"))
        buy_amount_min = buy_amount_max * risk_factor * Decimal("0.4")
        action = "add_position" if current_ratio > 0 else "build_position"
        source_payload = {
            "candidateId": candidate.id,
            "instrumentId": candidate.instrument_id,
            "assetClass": candidate.asset_class,
            "currency": candidate.currency,
            "isActive": candidate.is_active,
            "researchStatus": candidate.research_status,
            "currentAllocationRatio": format(current_ratio.normalize(), "f"),
            "targetAllocationMin": format((candidate.target_allocation_min or Decimal("0")).normalize(), "f"),
            "targetAllocationMax": format((candidate.target_allocation_max or target_ratio).normalize(), "f"),
            "cashRatio": format(cash_ratio.normalize(), "f"),
            "marketPrice": format(quote.price.normalize(), "f"),
            "trend": quote.trend,
            "valuationBand": quote.valuation_band,
        }
        if action == "build_position":
            trigger_reason = f"现金比例 {format(cash_ratio * 100, '.1f')}% 可用，候选标的估值/趋势条件满足，建议首次建仓。"
        else:
            trigger_reason = f"当前配置 {format(current_ratio * 100, '.1f')}% 低于目标上限 {format(target_ratio * 100, '.1f')}%，结合现金比例，建议加仓。"
        risk_note = "任何买入决策请结合流动性需求与自身投资期限；本系统仅给建议，不自动下单。"
        results.append(
            RuleRecommendation(
                action=action,
                title="首次建仓建议" if action == "build_position" else "候选加仓建议",
                instrument_id=candidate.instrument_id,
                candidate_id=candidate.id,
                suggested_allocation_min=candidate.target_allocation_min,
                suggested_allocation_max=candidate.target_allocation_max or target_ratio,
                suggested_amount_min=buy_amount_min,
                suggested_amount_max=buy_amount_max,
                position_change_pct=gap * Decimal("0.5"),
                trigger_reason=trigger_reason,
                risk_note=risk_note,
                evidence=evidence,
                counterevidence=[],
                source_data=source_payload,
            )
        )
    # 对未触发任何动作的持仓，输出「继续持有」决策，形成持仓决策卡覆盖所有持仓
    for position in active_positions:
        if position.instrument_id in triggered_position_ids:
            continue
        current_ratio = by_instrument.get(position.instrument_id, Decimal("0")) / total_value
        quote = quotes[position.instrument_id]
        hold_evidence: list[dict[str, str]] = []
        if current_ratio <= max_concentration:
            hold_evidence.append(_evidence("concentration_ok", "当前集中度处于个人设定范围内。"))
        asset_target = _target_for_asset(profile, position.asset_class)
        if asset_target and abs(current_ratio - asset_target) <= Decimal("0.05"):
            hold_evidence.append(_evidence("allocation_on_target", "当前配置与目标配置偏差在 5% 以内。"))
        if quote.trend != "down":
            hold_evidence.append(_evidence("trend_not_down", "标的价格趋势没有进入明确下行通道。"))
        source_payload = {
            "instrumentId": position.instrument_id,
            "accountId": position.account_id,
            "assetClass": position.asset_class,
            "currency": position.currency,
            "quantity": format(position.quantity.normalize(), "f"),
            "currentMarketValue": format(position.market_value.normalize(), "f"),
            "currentAllocationRatio": format(current_ratio.normalize(), "f"),
            "marketPrice": format(quote.price.normalize(), "f"),
            "trend": quote.trend,
        }
        results.append(
            RuleRecommendation(
                action="hold",
                title="保持当前仓位",
                instrument_id=position.instrument_id,
                candidate_id=None,
                suggested_allocation_min=None,
                suggested_allocation_max=None,
                suggested_amount_min=Decimal("0"),
                suggested_amount_max=Decimal("0"),
                position_change_pct=Decimal("0"),
                trigger_reason="当前持仓未触发任何减仓/卖出条件，继续持有符合既定配置。",
                risk_note="每交易日收盘后系统会再次复核，任何条件变化都会生成新的行动卡提醒。",
                evidence=hold_evidence,
                counterevidence=[],
                confidence="medium",
                source_data=source_payload,
            )
        )
    priority = {"reduce_risk": 0, "exit_review": 1, "rebalance": 2, "add_position": 3, "build_position": 4, "hold": 99}
    return sorted(results, key=lambda result: (priority.get(result.action, 50), result.instrument_id))
