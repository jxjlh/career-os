"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CandidatePool } from "@/components/finance/candidate-pool";
import { AssetSummaryCard } from "@/components/finance/cards/asset-summary-card";
import { MarketDailyCard } from "@/components/finance/cards/market-daily-card";
import { NewFundBuyCardView } from "@/components/finance/cards/new-fund-buy-card";
import { PositionDecisionCard } from "@/components/finance/cards/position-decision-card";
import { FinanceDashboardView } from "@/components/finance/finance-dashboard";
import { HoldingTable } from "@/components/finance/holding-table";
import { ImportHoldingsDialog } from "@/components/finance/import-holdings-dialog";
import { ManualTransactionDialog } from "@/components/finance/manual-transaction-dialog";
import { RecommendationCard } from "@/components/finance/recommendation-card";
import { RiskSettingsForm } from "@/components/finance/risk-settings-form";
import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  financeQueryKeys,
  type FinanceHolding,
  type FinanceImport,
  type FinanceImportRow,
  type TransactionCreate,
} from "@/lib/finance";

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.code ? `${error.message}（${error.code}）` : error.message;
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<FinanceHolding | null>(null);
  const candidatesAnchorRef = useRef<HTMLDivElement | null>(null);

  const invalidatePortfolio = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.holdings() }),
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions() }),
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.recommendations() }),
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.latestAnalysis() }),
    ]);

  const dashboard = useQuery({ queryKey: financeQueryKeys.dashboard(), queryFn: financeApi.getDashboard });
  const accounts = useQuery({ queryKey: financeQueryKeys.accounts(), queryFn: financeApi.getAccounts });
  const candidates = useQuery({ queryKey: financeQueryKeys.candidates(), queryFn: financeApi.getCandidates });
  const recommendations = useQuery({ queryKey: financeQueryKeys.recommendations(), queryFn: financeApi.getRecommendations });
  const analysis = useQuery({ queryKey: financeQueryKeys.latestAnalysis(), queryFn: financeApi.getLatestAnalysis });

  const pendingActionCount = useMemo(() => {
    // 未读行动卡：非 hold / observe / pause 的 pending 建议
    return (recommendations.data?.data ?? []).filter((r) => {
      if (r.disposition === "dismissed") return false;
      return !["hold", "observe", "pause"].includes(r.action);
    }).length;
  }, [recommendations.data?.data]);

  const updateProfile = useMutation({
    mutationFn: financeApi.updateProfile,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard() }),
  });
  const createDefaultAccount = useMutation({
    mutationFn: () => financeApi.createAccount({ name: "默认基金账户", market: "CN", currency: "CNY", accountType: "fund" }),
    onSuccess: ({ data: account }) => {
      queryClient.setQueryData(financeQueryKeys.accounts(), (current: { data: typeof account[] } | undefined) => ({
        data: [...(current?.data || []), account],
      }));
    },
  });
  const createTransaction = useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: () => {
      setManualOpen(false);
      setSelectedHolding(null);
      void invalidatePortfolio();
    },
  });
  const runAnalysis = useMutation({
    mutationFn: financeApi.runAnalysis,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.latestAnalysis() });
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.recommendations() });
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard() });
    },
  });
  const dismissRecommendation = useMutation({
    mutationFn: financeApi.dismissRecommendation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: financeQueryKeys.recommendations() }),
  });
  const archiveCandidate = useMutation({
    mutationFn: (id: string) => financeApi.updateCandidate(id, { researchStatus: "archived" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: financeQueryKeys.candidates() }),
  });
  const uploadImport = useMutation({ mutationFn: financeApi.uploadScreenshots });
  const confirmImport = useMutation({
    mutationFn: ({ item, rows }: { item: FinanceImport; rows: FinanceImportRow[] }) => financeApi.confirmImport(item.id, rows),
    onSuccess: () => void invalidatePortfolio(),
  });
  const discardImport = useMutation({
    mutationFn: (item: FinanceImport) => financeApi.discardImport(item.id),
    onSuccess: () => void invalidatePortfolio(),
  });

  const openTransaction = async (holding?: FinanceHolding) => {
    if (!holding && !(accounts.data?.data.length)) await createDefaultAccount.mutateAsync();
    setSelectedHolding(holding || null);
    setManualOpen(true);
  };

  const baseCurrency = dashboard.data?.data.profile.baseCurrency ?? "CNY";
  const pendingActionRecs = (recommendations.data?.data ?? []).filter((r) => r.disposition !== "dismissed" && !["hold", "observe", "pause"].includes(r.action));

  return (
    <div className="space-y-8">
      <FinanceDashboardView
        dashboard={dashboard.data?.data}
        analysis={analysis.data?.data}
        pendingActionCount={pendingActionCount}
        isLoading={dashboard.isLoading}
        error={errorMessage(dashboard.error)}
        onRunAnalysis={() => runAnalysis.mutate()}
        isRunning={runAnalysis.isPending}
      />

      {pendingActionRecs.length > 0 && (
        <section>
          <SectionHeader
            title="未读行动卡通知"
            subtitle="以下加减仓/卖出/建仓建议会在每日 14:45 自动生成；只提供建议，绝不自动下单。"
            action={<Badge variant="danger">{pendingActionRecs.length} 条需要复核</Badge>}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingActionRecs.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                onDismiss={() => dismissRecommendation.mutate(item.id)}
                isDismissing={dismissRecommendation.isPending}
                baseCurrency={baseCurrency}
              />
            ))}
          </div>
        </section>
      )}

      <PositionDecisionCard
        positions={dashboard.data?.data.positions ?? []}
        recommendations={recommendations.data?.data ?? []}
        positionDecisions={dashboard.data?.data.positionDecisions}
        baseCurrency={baseCurrency}
        onDismiss={(id) => dismissRecommendation.mutate(id)}
        isDismissing={dismissRecommendation.isPending}
      />

      <NewFundBuyCardView
        card={dashboard.data?.data.newFundBuyCard}
        baseCurrency={baseCurrency}
        onGoCandidates={() => candidatesAnchorRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <MarketDailyCard daily={dashboard.data?.data.marketDaily} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Camera className="h-4 w-4" />
          截图导入
        </Button>
        <Button size="sm" variant="primary" onClick={() => void openTransaction()} disabled={createDefaultAccount.isPending}>
          {createDefaultAccount.isPending ? (
            "正在准备账户…"
          ) : (
            <>
              <Plus className="h-4 w-4" />
              手工记账
            </>
          )}
        </Button>
      </div>

      {runAnalysis.error && <p className="-mt-5 text-sm text-danger">分析未完成：{errorMessage(runAnalysis.error)}</p>}

      <section>
        <SectionHeader
          title="规则建议（完整列表）"
          subtitle="候选基金建仓/加仓建议在此列表也会一并展示；卡片只在个人理财中显示，任何建议都不会自动下单。"
        />
        {recommendations.isLoading ? (
          <Card className="p-5 text-sm text-text-tertiary">正在加载规则建议…</Card>
        ) : (recommendations.data?.data.length || 0) > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.data?.data.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                onDismiss={() => dismissRecommendation.mutate(item.id)}
                isDismissing={dismissRecommendation.isPending}
                baseCurrency={baseCurrency}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="暂时没有行动卡"
            description="缺少授权行情、数据过期或规则条件不足时，系统不会输出买入、加仓、减仓或卖出建议。"
            action={
              <Button size="sm" variant="outline" onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending}>
                <Sparkles className="h-3.5 w-3.5" />
                重新分析
              </Button>
            }
          />
        )}
      </section>

      <section>
        <SectionHeader title="我的持仓" subtitle="交易按发生日期重算；可继续从同一持仓追加买入或卖出。" />
        <HoldingTable
          holdings={dashboard.data?.data.positions || []}
          onAddTransaction={openTransaction}
        />
      </section>

      <div ref={candidatesAnchorRef} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RiskSettingsForm
          profile={
            dashboard.data?.data.profile || {
              id: "",
              riskPreference: "balanced",
              baseCurrency: "CNY",
              targetAllocation: {},
              reserveCashRatio: "0.2",
              maxInstrumentConcentration: "0.3",
              maxPortfolioDrawdown: "0.2",
              maxInstrumentDrawdown: "0.15",
              investmentHorizon: "long_term",
              alertSettings: {},
            }
          }
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
          error={errorMessage(updateProfile.error)}
        />
        <CandidatePool
          candidates={candidates.data?.data || []}
          onArchive={(candidate) => archiveCandidate.mutate(candidate.id)}
          isUpdating={archiveCandidate.isPending}
          error={errorMessage(candidates.error) || errorMessage(archiveCandidate.error)}
        />
      </div>

      <ManualTransactionDialog
        open={manualOpen}
        accounts={accounts.data?.data || []}
        holding={selectedHolding}
        onClose={() => {
          setManualOpen(false);
          setSelectedHolding(null);
        }}
        onSubmit={(payload: TransactionCreate) => createTransaction.mutate(payload)}
        isSubmitting={createTransaction.isPending}
        error={errorMessage(createTransaction.error) || errorMessage(createDefaultAccount.error)}
      />
      <ImportHoldingsDialog
        open={importOpen}
        accounts={accounts.data?.data || []}
        onClose={() => setImportOpen(false)}
        onUpload={async (files) => (await uploadImport.mutateAsync(files)).data}
        onConfirm={async (item, rows) => {
          await confirmImport.mutateAsync({ item, rows });
        }}
        onDiscard={async (item) => {
          await discardImport.mutateAsync(item);
        }}
        isUploading={uploadImport.isPending}
        isSaving={confirmImport.isPending || discardImport.isPending}
        error={errorMessage(uploadImport.error) || errorMessage(confirmImport.error) || errorMessage(discardImport.error)}
      />
    </div>
  );
}
