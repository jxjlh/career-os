import type { FinanceDashboard } from "@/lib/finance";

const fixture: FinanceDashboard = {
  profile: {
    id: "profile-1",
    riskPreference: "balanced",
    baseCurrency: "CNY",
    targetAllocation: { fund: "0.6", cash: "0.2" },
    reserveCashRatio: "0.2",
    maxInstrumentConcentration: "0.3",
    maxPortfolioDrawdown: "0.2",
    maxInstrumentDrawdown: "0.15",
    investmentHorizon: "long_term",
    alertSettings: {},
  },
  summary: {
    baseCurrency: "CNY",
    positionCount: 0,
    pricedPositionCount: 0,
    costBasis: "1000",
    marketValue: null,
    costBasisByCurrency: { CNY: "1000" },
    marketValueByCurrency: {},
  },
  positions: [],
  dataStatus: "manual_only",
};

void fixture;
