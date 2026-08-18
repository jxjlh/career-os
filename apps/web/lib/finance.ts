import { apiFetch } from "@/lib/api";

export type FinanceMarket = "CN" | "HK" | "US";
export type FinanceCurrency = "CNY" | "HKD" | "USD";
export type FinanceAssetClass = "fund" | "etf" | "stock";
export type RiskPreference = "conservative" | "balanced" | "aggressive";
export type TransactionType = "buy" | "sell" | "dividend" | "fee";
export type RecommendationAction = "observe" | "build" | "add" | "pause" | "rebalance" | "reduce_risk" | "exit_review";

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
  quantity: string;
  averageCost: string;
  costBasis: string;
  marketPrice: string | null;
  marketValue: string | null;
  currency: FinanceCurrency;
  targetAllocation: string | null;
  valuedAt: string | null;
}

export interface FinanceDashboardSummary {
  baseCurrency: FinanceCurrency;
  positionCount: number;
  pricedPositionCount: number;
  costBasis: string | null;
  marketValue: string | null;
  costBasisByCurrency: Partial<Record<FinanceCurrency, string>>;
  marketValueByCurrency: Partial<Record<FinanceCurrency, string>>;
}

export interface FinanceDashboard {
  profile: FinanceProfile;
  summary: FinanceDashboardSummary;
  positions: FinanceHolding[];
  dataStatus: "manual_only" | string;
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
