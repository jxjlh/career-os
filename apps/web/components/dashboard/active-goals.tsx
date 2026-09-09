"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { getLifeGoals, createLifeGoal, type LifeGoal, type LifeGoalInput } from "@/lib/life";
import { GoalRow } from "./goal-row";

// 分类配置: icon + label + 动态字段
const CATEGORIES = [
  {
    key: "career",
    label: "事业",
    icon: "💼",
    fields: [
      { name: "targetRole", label: "目标职位", placeholder: "如: 高级前端工程师" },
      { name: "targetDate", label: "目标日期", placeholder: "YYYY-MM-DD", type: "date" },
    ],
  },
  {
    key: "skill",
    label: "技能",
    icon: "🚀",
    fields: [
      { name: "skillName", label: "技能名称", placeholder: "如: React / Python / 设计" },
      { name: "targetLevel", label: "目标水平", placeholder: "如: 熟练 / 精通" },
    ],
  },
  {
    key: "health",
    label: "健康",
    icon: "💪",
    fields: [
      { name: "targetWeight", label: "目标体重", placeholder: "如: 65kg" },
      { name: "exerciseType", label: "运动类型", placeholder: "如: 跑步 / 健身 / 游泳" },
    ],
  },
  {
    key: "travel",
    label: "旅行",
    icon: "🌍",
    fields: [
      { name: "location", label: "目的地", placeholder: "如: 东京 / 巴黎" },
      { name: "budget", label: "预算", placeholder: "如: 10000元" },
      { name: "bestSeason", label: "最佳季节", placeholder: "如: 春季 / 秋季" },
    ],
  },
  {
    key: "finance",
    label: "财富",
    icon: "💰",
    fields: [
      { name: "targetAmount", label: "目标金额", placeholder: "如: 100000元" },
      { name: "timeframe", label: "时间范围", placeholder: "如: 1年内" },
    ],
  },
  {
    key: "life",
    label: "生活",
    icon: "✨",
    fields: [
      { name: "description", label: "描述", placeholder: "详细描述你的目标..." },
    ],
  },
] as const;

/**
 * YOUR LIFE RIGHT NOW / ACTIVE GOALS —— 轻量 Row 列表（非巨大 Card）。
 * 右上角 ＋Add goal 点击展开内联创建表单, 根据分类动态显示字段.
 */
export function ActiveGoals() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const goals = useQuery({ queryKey: ["life-goals"], queryFn: getLifeGoals });

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>("career");
  const [title, setTitle] = useState("");
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
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

  const currentCategory = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0];

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      // 构建描述: 把动态字段拼成描述
      const fieldParts = currentCategory.fields
        .filter((f) => dynamicFields[f.name])
        .map((f) => `${f.label}: ${dynamicFields[f.name]}`);
      const description = fieldParts.length > 0 ? fieldParts.join("\n") : undefined;

      // 根据分类映射到后端字段
      const payload: LifeGoalInput = {
        title: title.trim(),
        category,
        difficulty: 3,
        description,
      };

      // 旅行类特殊处理
      if (category === "travel") {
        if (dynamicFields.location) payload.location = dynamicFields.location;
        if (dynamicFields.budget) payload.budget = dynamicFields.budget;
        if (dynamicFields.bestSeason) payload.bestSeason = dynamicFields.bestSeason;
      }

      await createLifeGoal(payload);
      await queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      setTitle("");
      setDynamicFields({});
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setDynamicFields({});
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
          className="-mr-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-elevated/70 hover:text-primary-glow"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
              {/* 标题输入 */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={`输入你的${currentCategory.label}目标...`}
                autoFocus
                className="w-full rounded-lg border border-white/5 bg-surface/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary/60 focus:border-primary/40 focus:outline-none"
              />

              {/* 分类选择 */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryChange(cat.key)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] transition-colors ${
                      category === cat.key
                        ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                        : "bg-surface/40 text-text-tertiary hover:bg-surface-elevated/60"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 动态字段 (根据分类显示) */}
              <div className="mt-3 space-y-2">
                {currentCategory.fields.map((field) => (
                  <div key={field.name}>
                    <label className="mb-1 block text-[11px] text-text-tertiary">
                      {field.label}
                    </label>
                    <input
                      type={"type" in field && field.type === "date" ? "date" : "text"}
                      value={dynamicFields[field.name] || ""}
                      onChange={(e) =>
                        setDynamicFields((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-white/5 bg-surface/50 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary/60 focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="mt-3 w-full rounded-lg bg-primary py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "创建中..." : `创建${currentCategory.label}目标`}
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
              href={`/life/goals/detail?id=${g.id}`}
            />
          ))
        )}
      </div>
    </section>
  );
}
