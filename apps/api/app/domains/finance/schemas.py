from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

Market = Literal["CN", "HK", "US"]
Currency = Literal["CNY", "HKD", "USD"]
AssetClass = Literal["fund", "etf", "stock"]
RiskPreference = Literal["conservative", "balanced", "aggressive"]
TransactionType = Literal["buy", "sell", "dividend", "fee"]

MARKET_CURRENCY: dict[str, str] = {"CN": "CNY", "HK": "HKD", "US": "USD"}
Money = Annotated[Decimal, Field(max_digits=20, decimal_places=8)]
PositiveMoney = Annotated[Decimal, Field(gt=Decimal("0"), max_digits=20, decimal_places=8)]
Ratio = Annotated[Decimal, Field(ge=Decimal("0"), le=Decimal("1"), max_digits=6, decimal_places=4)]


class FinanceSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class FinanceProfilePatch(FinanceSchema):
    risk_preference: RiskPreference | None = None
    base_currency: Currency | None = None
    reserve_cash_ratio: Ratio | None = None
    target_allocation: dict[AssetClass | Literal["cash"], Ratio] | None = None
    max_instrument_concentration: Ratio | None = None
    max_portfolio_drawdown: Ratio | None = None
    max_instrument_drawdown: Ratio | None = None
    investment_horizon: Literal["short_term", "medium_term", "long_term"] | None = None
    alert_settings: dict[str, Any] | None = None

    @model_validator(mode="after")
    def target_allocation_is_not_over_100_percent(self) -> "FinanceProfilePatch":
        if self.target_allocation is not None and sum(self.target_allocation.values()) > Decimal("1"):
            raise ValueError("targetAllocation must not exceed 1")
        return self


class FinanceAccountCreate(FinanceSchema):
    name: str = Field(min_length=1, max_length=120)
    market: Market
    currency: Currency
    account_type: Literal["fund", "stock", "broker", "manual"] = "manual"

    @model_validator(mode="after")
    def currency_matches_market(self) -> "FinanceAccountCreate":
        if self.currency != MARKET_CURRENCY[self.market]:
            raise ValueError("currency must match the selected market")
        return self


class FinanceAccountPatch(FinanceSchema):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    market: Market | None = None
    currency: Currency | None = None
    account_type: Literal["fund", "stock", "broker", "manual"] | None = None

    @model_validator(mode="after")
    def currency_matches_provided_market(self) -> "FinanceAccountPatch":
        if self.market and self.currency and self.currency != MARKET_CURRENCY[self.market]:
            raise ValueError("currency must match the selected market")
        return self


class FinancialInstrumentInput(FinanceSchema):
    market: Market
    symbol: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=300)
    asset_class: AssetClass
    currency: Currency
    product_type: str | None = Field(default=None, max_length=48)
    identifier: str | None = Field(default=None, max_length=96)
    benchmark: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def currency_matches_market(self) -> "FinancialInstrumentInput":
        if self.currency != MARKET_CURRENCY[self.market]:
            raise ValueError("currency must match the selected market")
        return self


class FinanceTransactionCreate(FinanceSchema):
    account_id: str
    instrument_id: str | None = None
    instrument: FinancialInstrumentInput | None = None
    transaction_type: TransactionType
    quantity: PositiveMoney
    unit_price: Money
    fee: Money = Decimal("0")
    client_reference: str = Field(min_length=1, max_length=128)
    currency: Currency | None = None
    occurred_on: date
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def has_exactly_one_instrument_reference(self) -> "FinanceTransactionCreate":
        if bool(self.instrument_id) == bool(self.instrument):
            raise ValueError("provide exactly one of instrumentId or instrument")
        return self


class FinanceTransactionPatch(FinanceSchema):
    account_id: str | None = None
    instrument_id: str | None = None
    transaction_type: TransactionType | None = None
    quantity: PositiveMoney | None = None
    unit_price: Money | None = None
    fee: Money | None = None
    currency: Currency | None = None
    occurred_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def contains_an_update(self) -> "FinanceTransactionPatch":
        if not self.model_fields_set:
            raise ValueError("provide at least one transaction field")
        return self


class FinanceCandidateCreate(FinanceSchema):
    instrument_id: str
    suitability_reason: str | None = Field(default=None, max_length=3000)
    allocation_gap: dict[str, str] = Field(default_factory=dict)
    target_allocation_min: Ratio | None = None
    target_allocation_max: Ratio | None = None
    research_status: Literal["watching", "researching", "ready", "archived"] = "watching"
    alert_eligible: bool = True

    @model_validator(mode="after")
    def allocation_range_is_valid(self) -> "FinanceCandidateCreate":
        if (
            self.target_allocation_min is not None
            and self.target_allocation_max is not None
            and self.target_allocation_min > self.target_allocation_max
        ):
            raise ValueError("targetAllocationMin must not exceed targetAllocationMax")
        return self


class FinanceCandidatePatch(FinanceSchema):
    suitability_reason: str | None = Field(default=None, max_length=3000)
    allocation_gap: dict[str, str] | None = None
    target_allocation_min: Ratio | None = None
    target_allocation_max: Ratio | None = None
    research_status: Literal["watching", "researching", "ready", "archived"] | None = None
    alert_eligible: bool | None = None

    @model_validator(mode="after")
    def allocation_range_is_valid(self) -> "FinanceCandidatePatch":
        if (
            self.target_allocation_min is not None
            and self.target_allocation_max is not None
            and self.target_allocation_min > self.target_allocation_max
        ):
            raise ValueError("targetAllocationMin must not exceed targetAllocationMax")
        return self


class FinanceImportRow(FinanceSchema):
    """An OCR row that the user may correct before confirming it as a transaction."""

    row_id: str = Field(default_factory=lambda: uuid4().hex, min_length=1, max_length=64)
    account_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=300)
    symbol: str | None = Field(default=None, min_length=1, max_length=64)
    market: Market | None = None
    asset_class: AssetClass | None = None
    currency: Currency | None = None
    quantity: PositiveMoney | None = None
    unit_price: Money | None = None
    fee: Money = Decimal("0")
    occurred_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    confidence: Ratio = Decimal("0")

    @model_validator(mode="after")
    def instrument_values_are_consistent(self) -> "FinanceImportRow":
        values = (self.name, self.symbol, self.market, self.asset_class, self.currency)
        if any(value is not None for value in values) and any(value is None for value in values):
            raise ValueError("recognized instrument data must include name, symbol, market, assetClass, and currency")
        if self.market is not None and self.currency != MARKET_CURRENCY[self.market]:
            raise ValueError("currency must match the selected market")
        return self


class FinanceImportPatch(FinanceSchema):
    rows: list[FinanceImportRow] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def row_ids_are_unique(self) -> "FinanceImportPatch":
        if len({row.row_id for row in self.rows}) != len(self.rows):
            raise ValueError("rowId values must be unique")
        return self


class FinanceImportConfirm(FinanceImportPatch):
    pass
