"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { getLifeGoals, createLifeGoal, type LifeGoal } from "@/lib/life";
import { GoalRow } from "./goal-row";

/**
 * YOUR LIFE RIGHT NOW / ACTIVE GOALS —— 轻量 Row 列表（非巨大 Card）。
 * 右上角 ＋Add goal 点击展开内联创建表单, 不跳转页面.
 */
export function ActiveGoals() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const goals = useQuery({ queryKey: ["life-goals"], queryFn: getLifeGoals });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("career");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active: LifeGoal[] = (goals.data ?? [])
    .filter((g) => g.status !== "completed")
    .slice(0, 5);

  const progressOf = (g: LifeGoal) => {
    if (g.status === "completed") return 100;
    const d = g.difficulty ?? 1;
    return Math.min(95, Math.round((d / 5) * 100));
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createLifeGoal({
        title: title.trim(),
        category,
        difficulty: 3,
      });
      await queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      setTitle("");
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || "创建失败");
    } finally {
      setCreating(false);
    }
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-primary-glow"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{showForm ? "取消" : t("dashboard.addGoal")}</span>
        </button>
      </div>

      {/* 内联创建表单 */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-white/10 bg-surface/40 p-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="输入你的人生目标..."
                autoFocus
                className="w-full rounded-lg border border-white/5 bg-surface/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary/60 focus:border-primary/40 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                {[
                  { key: "career", label: "事业" },
                  { key: "health", label: "健康" },
                  { key: "learning", label: "学习" },
                  { key: "life", label: "生活" },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                      category === cat.key
                        ? "bg-primary/20 text-primary"
                        : "bg-surface/40 text-text-tertiary hover:bg-surface-elevated/60"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="mt-3 w-full rounded-lg bg-primary py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建目标"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              href={`/life?goal=${g.id}`}
            />
          ))
        )}
      </div>
    </section>
  );
}
