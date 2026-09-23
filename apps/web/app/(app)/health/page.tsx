"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  Check,
  Copy,
  Footprints,
  Flame,
  Loader2,
  Moon,
  Plus,
  RefreshCw,
  Ruler,
  Timer,
  Trash2,
  Watch,
} from "lucide-react";

import { Button } from "@/components/ui";
import { healthApi, localToday, SOURCE_LABELS, formatNumber, formatSleep, type HealthDay } from "@/lib/health";

type Envelope = { data: any };

export default function HealthPage() {
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => localToday(), []);

  const daily = useQuery<Envelope>({
    queryKey: ["health-daily", todayStr, todayStr],
    queryFn: () => healthApi.daily(todayStr, todayStr),
  });
  const week = useQuery<Envelope>({
    queryKey: ["health-week"],
    queryFn: () => healthApi.daily(localTodayWithOffset(-6), todayStr),
  });
  const summary = useQuery<Envelope>({
    queryKey: ["health-summary", 7],
    queryFn: () => healthApi.summary(7),
  });
  const status = useQuery<Envelope>({
    queryKey: ["health-status"],
    queryFn: () => healthApi.status(),
  });

  const today: HealthDay | undefined = daily.data?.data?.days?.[0];
  const weekDays: HealthDay[] = week.data?.data?.days ?? [];

  const invalidateAll = () => {
    ["health-daily", "health-week", "health-summary", "health-status"].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] }),
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-text">健康</h1>
          <p className="mt-1 text-[13px] text-text-tertiary">
            来自手机的健康数据，自动同步 · 手动补录
          </p>
        </div>
        <div className="text-right text-[12px] text-text-tertiary">
          {status.data?.data?.lastSyncedAt ? (
            <p>
              上次同步：
              {new Date(status.data.data.lastSyncedAt).toLocaleString("zh-CN", { hour12: false })}
            </p>
          ) : (
            <p>还没有同步记录</p>
          )}
          {status.data?.data?.sources && status.data.data.sources.length > 0 && (
            <p className="mt-0.5">
              数据来源：
              {status.data.data.sources.map((s: string) => SOURCE_LABELS[s] ?? s).join("、")}
            </p>
          )}
        </div>
      </div>

      {/* 今日六卡 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <TodayCard icon={Footprints} label="步数" value={today ? formatNumber(today.steps) : "--"} tint="bg-blue-100 text-blue-600" />
        <TodayCard icon={Ruler} label="距离" value={today ? formatNumber(today.distanceKm, " 公里") : "--"} tint="bg-cyan-100 text-cyan-600" />
        <TodayCard icon={Flame} label="活动能量" value={today ? formatNumber(today.activeEnergyKcal != null ? Math.round(today.activeEnergyKcal) : null, " 千卡") : "--"} tint="bg-orange-100 text-orange-600" />
        <TodayCard icon={Timer} label="锻炼分钟" value={today ? formatNumber(today.exerciseMinutes, " 分钟") : "--"} tint="bg-green-100 text-green-600" />
        <TodayCard icon={Moon} label="睡眠时长" value={today ? formatSleep(today.sleepMinutes) : "--"} tint="bg-indigo-100 text-indigo-600" />
        <TodayCard icon={Activity} label="静息心率" value={today ? formatNumber(today.restingHr, " 次/分") : "--"} tint="bg-rose-100 text-rose-600" />
      </div>

      {/* 近 7 日 + 7 日均值 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-text">近 7 天</h3>
            <button
              onClick={() => { week.refetch(); summary.refetch(); }}
              className="flex items-center gap-1 text-[12px] text-primary hover:text-primary-glow"
            >
              <RefreshCw className="h-3 w-3" /> 刷新
            </button>
          </div>
          {week.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-[12px] text-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : weekDays.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-text-tertiary">
              还没有数据 —— 在下方手动补录，或在 iPhone 上配置快捷指令自动同步
            </p>
          ) : (
            <div className="space-y-1.5">
              {weekDays
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.date} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[12px] odd:bg-surface-elevated/60">
                    <span className="w-20 shrink-0 text-text-tertiary">{d.date.slice(5).replace("-", "/")}</span>
                    <span className="w-16 shrink-0 font-medium text-text">{d.steps != null ? d.steps.toLocaleString("zh-CN") : "--"}</span>
                    <span className="w-20 shrink-0 text-text-secondary">睡 {d.sleepMinutes != null ? formatSleep(d.sleepMinutes) : "--"}</span>
                    <span className="w-16 shrink-0 text-text-secondary">心 {d.restingHr ?? "--"}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-text-tertiary/70">{SOURCE_LABELS[d.source] ?? d.source}</span>
                  </div>
                ))}
            </div>
          )}
          {summary.data?.data && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-4 text-[12px] sm:grid-cols-4">
              <MiniStat label="日均步数" value={summary.data.data.avgSteps} />
              <MiniStat label="日均睡眠" value={summary.data.data.avgSleepMinutes != null ? `${Math.round(summary.data.data.avgSleepMinutes / 6) / 10} 小时` : null} />
              <MiniStat label="日均静息心率" value={summary.data.data.avgRestingHr} unit=" 次/分" />
              <MiniStat label="7 天中有数据" value={summary.data.data.daysWithData} unit=" 天" />
            </div>
          )}
        </div>

        {/* 手动补录 */}
        <ManualForm onSaved={invalidateAll} />
      </div>

      {/* 同步设置 */}
      <SyncSettings status={status.data?.data} onChanged={invalidateAll} />
    </div>
  );
}

function localTodayWithOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TodayCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
      <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-[17px] font-semibold leading-tight text-text">{value}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, unit = "" }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-text">
        {value == null || value === "" ? "--" : `${typeof value === "number" ? value.toLocaleString("zh-CN") : value}${unit}`}
      </p>
    </div>
  );
}

const EMPTY_FORM = { steps: "", distance_km: "", active_energy_kcal: "", exercise_minutes: "", sleep_minutes: "", resting_hr: "" };

function ManualForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [date, setDate] = useState(localToday());
  const [message, setMessage] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      healthApi.manual({
        metric_date: date,
        source: "manual",
        steps: form.steps === "" ? null : Number(form.steps),
        distance_km: form.distance_km === "" ? null : Number(form.distance_km),
        active_energy_kcal: form.active_energy_kcal === "" ? null : Number(form.active_energy_kcal),
        exercise_minutes: form.exercise_minutes === "" ? null : Number(form.exercise_minutes),
        sleep_minutes: form.sleep_minutes === "" ? null : Number(form.sleep_minutes),
        resting_hr: form.resting_hr === "" ? null : Number(form.resting_hr),
      }),
    onSuccess: () => {
      setMessage("已保存（只填了空缺项或更高来源的数据不会被覆盖）");
      setForm(EMPTY_FORM);
      onSaved();
    },
    onError: () => setMessage("保存失败，请稍后再试"),
  });

  const fields: { key: keyof typeof EMPTY_FORM; label: string; placeholder: string }[] = [
    { key: "steps", label: "步数", placeholder: "如 8642" },
    { key: "sleep_minutes", label: "睡眠（分钟）", placeholder: "如 420" },
    { key: "resting_hr", label: "静息心率", placeholder: "如 58" },
    { key: "active_energy_kcal", label: "活动能量（千卡）", placeholder: "如 312" },
    { key: "exercise_minutes", label: "锻炼（分钟）", placeholder: "如 30" },
    { key: "distance_km", label: "距离（公里）", placeholder: "如 6.1" },
  ];

  return (
    <div className="col-span-12 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm lg:col-span-5">
      <div className="mb-4 flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="font-display text-[15px] font-semibold text-text">手动补录</h3>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-text-tertiary">
        安卓手机或没带表的日子在这里补。留空的项不影响已有数据。
      </p>
      <div className="space-y-2.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-[13px] text-text outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[10px] text-text-tertiary">{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-tertiary/50 focus:border-primary"
              />
            </label>
          ))}
        </div>
        <Button
          variant="primary"
          className="w-full"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存今日数据"}
        </Button>
        {message && <p className="text-center text-[11px] text-text-tertiary">{message}</p>}
      </div>
    </div>
  );
}

function SyncSettings({ status, onChanged }: { status: any; onChanged: () => void }) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => healthApi.createToken("iPhone 快捷指令"),
    onSuccess: (res) => {
      setNewToken(res.data.token);
      onChanged();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => healthApi.revokeToken(id),
    onSuccess: () => onChanged(),
  });

  const copy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Watch className="h-4 w-4 text-primary" />
        <h3 className="font-display text-[15px] font-semibold text-text">手机同步设置</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 令牌管理 */}
        <div>
          <p className="mb-2 text-[12px] text-text-secondary">同步令牌（快捷指令用它推送数据）</p>
          {status?.tokens?.length > 0 ? (
            <div className="space-y-1.5">
              {status.tokens.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-surface-elevated px-3 py-2 text-[12px]">
                  <div>
                    <p className="font-medium text-text">{t.deviceLabel}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {t.lastUsedAt ? `最近使用 ${new Date(t.lastUsedAt).toLocaleString("zh-CN", { hour12: false })}` : "从未使用"}
                    </p>
                  </div>
                  <button
                    onClick={() => revoke.mutate(t.id)}
                    disabled={revoke.isPending}
                    className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 吊销
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-elevated px-3 py-3 text-[12px] text-text-tertiary">
              还没有同步令牌
            </p>
          )}
          <Button variant="primary" size="sm" className="mt-3" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "生成新令牌"}
          </Button>

          {newToken && (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[11px] text-text-secondary">
                令牌只显示这一次，请立即复制到快捷指令：
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2 py-1.5 text-[11px] text-text">{newToken}</code>
                <button
                  onClick={copy}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] text-white"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 快捷指令配置步骤 */}
        <div className="rounded-xl bg-surface-elevated p-4">
          <p className="mb-2 text-[12px] font-medium text-text">iPhone 快捷指令配置（约 2 分钟）</p>
          <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-text-secondary">
            <li>先点「生成新令牌」并复制</li>
            <li>打开「快捷指令」App → 自动化 → 新建「个人自动化」→ 选「特定时间」（建议 23:30）</li>
            <li>添加动作：<b>查找健康细节</b>（类型选「步数」，时间范围「今天」）</li>
            <li>再添加动作：<b>获取 URL 内容</b>，URL 填 <code className="rounded bg-surface px-1">https://growlog.club/api/v1/health/sync</code>，方法 POST，头部加 <code className="rounded bg-surface px-1">X-Sync-Token</code> = 刚才的令牌，请求体（JSON）按页面提示填写</li>
            <li>关闭「运行前询问」，完成 —— 每晚自动把当天步数推到这里</li>
          </ol>
          <p className="mt-2 text-[10px] text-text-tertiary">
            睡眠、心率等指标同理，每个指标一个「查找健康细节」动作。下面是可直接粘贴的请求体模板：
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2.5 text-[10px] leading-relaxed text-text-secondary">{`{
  "days": [{
    "metric_date": "今天(自动)",
    "steps": 步数变量的数字,
    "sleep_minutes": 睡眠分钟数,
    "resting_hr": 静息心率,
    "source": "iphone"
  }]
}`}</pre>
        </div>
      </div>
    </div>
  );
}
