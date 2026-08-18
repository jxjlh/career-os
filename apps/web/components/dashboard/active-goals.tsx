"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { getLifeGoals, type LifeGoal } from "@/lib/life";
import { GoalRow } from "./goal-row";

/**
 * YOUR LIFE RIGHT NOW / ACTIVE GOALS —— 轻量 Row 列表（非巨大 Card）。
 * 复用 getLifeGoals，过滤非 completed，取前 5。
 * 右上角 ＋Add goal 链接到 /life（不在首页弹创建表单，保持首页轻量）。
 */
export function ActiveGoals() {
  const { t } = useI18n();
  const goals = useQuery({ queryKey: ["life-goals"], queryFn: getLifeGoals });

  const active: LifeGoal[] = (goals.data ?? [])
    .filter((g) => g.status !== "completed")
    .slice(0, 5);

  // 进度计算：后端无统一 progress 字段，用 difficulty 作近似展示（1-5 映射 20-100%）
  // TODO: 后端补 goal progress 字段后切换精确值
  const progressOf = (g: LifeGoal) => {
    if (g.status === "completed") return 100;
    const d = g.difficulty ?? 1;
    return Math.min(95, Math.round((d / 5) * 100));
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {t("dashboard.yourLifeRightNow")}
          </h2>
          <p className="mt-1 font-display text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
            {t("dashboard.activeGoals")}
          </p>
        </div>
        <Link
          href="/life"
          className="flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-primary-glow"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t("dashboard.addGoal")}</span>
        </Link>
      </div>

      <div className="mt-3 divide-y divide-border-subtle/60">
        {active.length === 0 ? (
          <p className="py-6 text-[13px] text-text-tertiary">
            {t("common.empty")}
          </p>
        ) : (
          active.map((g, i) => (
            <GoalRow
              key={g.id}
              index={i + 1}
              title={g.title}
              progress={progressOf(g)}
              category={g.category}
              href={`/life/goals/${g.id}`}
            />
          ))
        )}
      </div>
    </section>
  );
}
