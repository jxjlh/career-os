import { apiFetch } from "@/lib/api";

import { createScreenshotImportForm } from "@/lib/finance-import-form";

export type FinanceMarket = "CN" | "HK" | "US";
export type FinanceCurrency = "CNY" | "HKD" | "USD";
export type FinanceAssetClass = "fund" | "etf" | "stock" | "cash";
export type RiskPreference = "conservative" | "balanced" | "aggressive";
export type TransactionType = "buy" | "sell" | "dividend" | "fee";
export type RecommendationAction =
  | "observe"
  | "build"
  | "add"
  | "pause"
  | "rebalance"
  | "reduce_risk"
  | "exit_review"
  | "hold"
  | "build_position"
  | "add_position";

export type ApiEnvelope<T> = { data: T };

export interface FinanceProfile {
  id: string;
  riskPreference: RiskPreference;
  baseCurrency: FinanceCurrency;
  targetAllocation: Partial<Record<FinanceAssetClass | "cash", string>>;
  reserveCashRatio: string;
  maxInstrumentConcentration: string;
  maxPortfolioDrawdown: string;
  maxInstrumentDrawdown: string;
  investmentHorizon: "short_term" | "medium_term" | "long_term";
  alertSettings: Record<string, unknown>;
}

export interface FinanceAccount {
  id: string;
  name: string;
  market: FinanceMarket;
  currency: FinanceCurrency;
  accountType: "fund" | "stock" | "broker" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface FinancialInstrument {
  id: string;
  market: FinanceMarket;
  symbol: string;
  name: string;
  assetClass: FinanceAssetClass;
  productType: string | null;
  currency: FinanceCurrency;
  identifier: string | null;
  benchmark: string | null;
}

export interface FinanceTransaction {
  id: string;
  accountId: string;
  instrumentId: string;
  transactionType: TransactionType;
  quantity: string;
  unitPrice: string;
  fee: string;
  clientReference: string;
  currency: FinanceCurrency;
  occurredOn: string;
  source: string;
  notes: string | null;
  createdAt: string;
}

export interface FinanceCandidate {
  id: string;
  instrumentId: string;
  suitabilityReason: string | null;
  allocationGap: Record<string, string>;
  targetAllocationMin: string | null;
  targetAllocationMax: string | null;
  researchStatus: "watching" | "researching" | "ready" | "archived";
  alertEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceHolding {
  id: string;
  accountId: string;
  accountName: string;
  instrumentId: string;
  instrument: FinancialInstrument;
  assetClass?: FinanceAssetClass;
  quantity: string;
  averageCost: string;
  costBasis: string;
  marketPrice: string | null;
  marketValue: string | null;
  dayChange?: string | null;
  unrealizedPnl?: string | null;
  unrealizedPnlPct?: string | null;
  currency: FinanceCurrency;
  targetAllocation: string | null;
  valuedAt: string | null;
}

export interface FinanceDashboardSummary {
  baseCurrency: FinanceCurrency;
  positionCount: number;
  pricedPositionCount: number;
  // 兼容旧前端：成本 / 总资产估值
  costBasis: string | null;
  marketValue: string | null;
  // 总资产卡 6 指标
  totalPositionValue?: string | null; // 总仓位金额（持仓市值，不含现金）
  dayChange?: string | null; // 今日收益
  cumulativeReturn?: string | null; // 累计收益
  returnRate?: string | null; // 收益率
  cashRatio?: string | null; // 可用现金比例
  availableCash?: string | null; // 可用现金金额
  costBasisByCurrency: Partial<Record<FinanceCurrency, string>>;
  marketValueByCurrency: Partial<Record<FinanceCurrency, string>>;
}

export interface MarketDailyIndexRow {
  name: string;
  symbol: string;
  changePercent: string | null;
  price: string | null;
}

export interface FinanceMarketDaily {
  date: string;
  overview: string;
  indexPerformances: MarketDailyIndexRow[];
  styleAndSectorChanges: string[];
  portfolioImpact: string[];
}

export interface NewFundBuyRecommendation {
  candidateId: string;
  instrumentId: string;
  name: string;
  symbol: string | null;
  assetClass: FinanceAssetClass;
  targetMin: string | null;
  targetMax: string | null;
  suggestedBuyMin: string;
  suggestedBuyMax: string;
  reason: string;
}

export interface NewFundBuyCard {
  eligibleForBuy: boolean;
  cashRatio: string | null;
  reserveCashRatio: string | null;
  maxInstrumentConcentration: string | null;
  riskPreference: RiskPreference;
  availableCash: string | null;
  candidateCount: number;
  recommendation: NewFundBuyRecommendation | null;
}

export interface PositionDecisionRow {
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  instrumentSymbol: string | null;
  accountName: string;
  decision: "buy_more" | "reduce" | "sell" | "hold";
  action: RecommendationAction;
  suggestedAmountMin: string | null;
  suggestedAmountMax: string | null;
  positionChangePct: string | null;
  triggerReason: string;
  riskNote: string;
  evidence: FinanceEvidence[] | null;
  holding: FinanceHolding;
}

export interface FinanceAnalysisSummary {
  id: string;
  status: string;
  runOn: string;
  dataFreshAt: string | null;
  completedAt: string | null;
  explanation: string | null;
  dataStatus: { state: string; reason: string } | null;
}

export interface FinanceDashboard {
  profile: FinanceProfile;
  summary: FinanceDashboardSummary;
  positions: FinanceHolding[];
  positionDecisions?: PositionDecisionRow[];
  pendingActionCount?: number;
  marketDaily?: FinanceMarketDaily;
  newFundBuyCard?: NewFundBuyCard;
  dataStatus: string;
  analysisRun?: FinanceAnalysisSummary | null;
}

export interface FinanceEvidence {
  code?: string;
  message: string;
  [key: string]: unknown;
}

export interface FinanceAnalysisRun {
  id: string;
  status: string;
  runOn: string;
  dataStatus: { state: string; reason: string };
  inputs: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  explanation: string | null;
  dataFreshAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface FinanceRecommendation {
  id: string;
  analysisRunId: string;
  candidateId: string | null;
  instrumentId: string | null;
  action: RecommendationAction;
  title: string;
  suggestedAllocationMin: string | null;
  suggestedAllocationMax: string | null;
  suggestedAmountMin: string | null;
  suggestedAmountMax: string | null;
  positionChangePct: string | null;
  triggerReason: string | null;
  riskNote: string | null;
  sourceData: Record<string, unknown> | null;
  explanation: string | null;
  evidence: FinanceEvidence[];
  counterevidence: FinanceEvidence[];
  confidence: string | null;
  expiresAt: string | null;
  disposition: "pending" | "dismissed" | string;
  createdAt: string;
}

export interface FinanceImportRow {
  rowId: string;
  accountId: string | null;
  name: string | null;
  symbol: string | null;
  market: FinanceMarket | null;
  assetClass: FinanceAssetClass | null;
  currency: FinanceCurrency | null;
  quantity: string | null;
  unitPrice: string | null;
  fee: string;
  occurredOn: string | null;
  notes: string | null;
  confidence: string;
}

export interface FinanceImport {
  id: string;
  sourceFilename: string | null;
  status: "processing" | "review" | "confirmed" | "discarded" | "failed" | string;
  rows: FinanceImportRow[];
  needsReview: boolean;
  temporaryObjectPath: string | null;
  errorCode: string | null;
  expiresAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceScreenshotImportFailure {
  filename: string;
  code: string;
}

export interface FinanceScreenshotImportBatch {
  imports: FinanceImport[];
  failures: FinanceScreenshotImportFailure[];
}

export type ProfilePatch = Partial<Pick<FinanceProfile, "riskPreference" | "baseCurrency" | "targetAllocation" | "reserveCashRatio" | "maxInstrumentConcentration" | "maxPortfolioDrawdown" | "maxInstrumentDrawdown" | "investmentHorizon" | "alertSettings">>;
export type AccountCreate = Pick<FinanceAccount, "name" | "market" | "currency"> & { accountType?: FinanceAccount["accountType"] };
export type AccountPatch = Partial<AccountCreate>;
export type InstrumentInput = Omit<FinancialInstrument, "id" | "productType" | "identifier" | "benchmark"> & Pick<Partial<FinancialInstrument>, "productType" | "identifier" | "benchmark">;
export type TransactionCreate = {
  accountId: string;
  instrumentId?: string;
  instrument?: InstrumentInput;
  transactionType: TransactionType;
  quantity: string;
  unitPrice: string;
  fee?: string;
  clientReference: string;
  currency?: FinanceCurrency;
  occurredOn: string;
  notes?: string;
};
export type TransactionPatch = Partial<Omit<TransactionCreate, "instrument" | "clientReference">>;
export type CandidateCreate = Omit<FinanceCandidate, "id" | "createdAt" | "updatedAt">;
export type CandidatePatch = Partial<Omit<CandidateCreate, "instrumentId">>;

const envelope = <T>(path: string, options?: RequestInit) => apiFetch<ApiEnvelope<T>>(path, options);
const json = (method: "POST" | "PATCH", body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const financeQueryKeys = {
  root: ["finance"] as const,
  dashboard: () => ["finance", "dashboard"] as const,
  profile: () => ["finance", "profile"] as const,
  accounts: () => ["finance", "accounts"] as const,
  holdings: () => ["finance", "holdings"] as const,
  transactions: () => ["finance", "transactions"] as const,
  candidates: () => ["finance", "candidates"] as const,
  recommendations: () => ["finance", "recommendations"] as const,
  latestAnalysis: () => ["finance", "analysis", "latest"] as const,
  import: (id: string) => ["finance", "import", id] as const,
};

export const financeApi = {
  getProfile: () => envelope<FinanceProfile>("/finance/profile"),
  updateProfile: (payload: ProfilePatch) => envelope<FinanceProfile>("/finance/profile", json("PATCH", payload)),
  getAccounts: () => envelope<FinanceAccount[]>("/finance/accounts"),
  getAccount: (id: string) => envelope<FinanceAccount>(`/finance/accounts/${id}`),
  createAccount: (payload: AccountCreate) => envelope<FinanceAccount>("/finance/accounts", json("POST", payload)),
  updateAccount: (id: string, payload: AccountPatch) => envelope<FinanceAccount>(`/finance/accounts/${id}`, json("PATCH", payload)),
  deleteAccount: (id: string) => apiFetch<void>(`/finance/accounts/${id}`, { method: "DELETE" }),
  getTransactions: () => envelope<FinanceTransaction[]>("/finance/transactions"),
  getTransaction: (id: string) => envelope<FinanceTransaction>(`/finance/transactions/${id}`),
  createTransaction: (payload: TransactionCreate) => envelope<FinanceTransaction>("/finance/transactions", json("POST", payload)),
  updateTransaction: (id: string, payload: TransactionPatch) => envelope<FinanceTransaction>(`/finance/transactions/${id}`, json("PATCH", payload)),
  deleteTransaction: (id: string) => apiFetch<void>(`/finance/transactions/${id}`, { method: "DELETE" }),
  uploadScreenshot: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return envelope<FinanceImport>("/finance/imports/screenshot", { method: "POST", body: form });
  },
  uploadScreenshots: (files: File[]) => {
    return envelope<FinanceScreenshotImportBatch>("/finance/imports/screenshots", { method: "POST", body: createScreenshotImportForm(files) });
  },
  getImport: (id: string) => envelope<FinanceImport>(`/finance/imports/${id}`),
  updateImport: (id: string, rows: FinanceImportRow[]) => envelope<FinanceImport>(`/finance/imports/${id}`, json("PATCH", { rows })),
  confirmImport: (id: string, rows: FinanceImportRow[]) => envelope<FinanceImport>(`/finance/imports/${id}/confirm`, json("POST", { rows })),
  discardImport: (id: string) => envelope<FinanceImport>(`/finance/imports/${id}/discard`, { method: "POST" }),
  getCandidates: () => envelope<FinanceCandidate[]>("/finance/candidates"),
  getCandidate: (id: string) => envelope<FinanceCandidate>(`/finance/candidates/${id}`),
  createCandidate: (payload: CandidateCreate) => envelope<FinanceCandidate>("/finance/candidates", json("POST", payload)),
  updateCandidate: (id: string, payload: CandidatePatch) => envelope<FinanceCandidate>(`/finance/candidates/${id}`, json("PATCH", payload)),
  deleteCandidate: (id: string) => apiFetch<void>(`/finance/candidates/${id}`, { method: "DELETE" }),
  searchInstruments: (query: string) => envelope<FinancialInstrument[]>(`/finance/instruments/search?q=${encodeURIComponent(query)}`),
  getDashboard: () => envelope<FinanceDashboard>("/finance/dashboard"),
  runAnalysis: () => envelope<FinanceAnalysisRun>("/finance/analysis/run", { method: "POST" }),
  getLatestAnalysis: () => envelope<FinanceAnalysisRun | null>("/finance/analysis/latest"),
  getRecommendations: () => envelope<FinanceRecommendation[]>("/finance/recommendations"),
  dismissRecommendation: (id: string) => envelope<FinanceRecommendation>(`/finance/recommendations/${id}/dismiss`, { method: "POST" }),
};

export function displayMoney(value: string | null | undefined, currency: FinanceCurrency): string {
  if (value === null || value === undefined) return "待行情更新";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function toPercent(value: string | null | undefined): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${(amount * 100).toFixed(amount * 100 >= 10 ? 0 : 1)}%` : "—";
}
