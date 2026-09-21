"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import {
  CATEGORY_META,
  getLifeGoals,
  createLifeGoal,
  type LifeGoal,
  type LifeGoalInput,
} from "@/lib/life";
import { buildCategoryValues, getCategoryFields } from "@/lib/life-fields";
import { GoalRow } from "./goal-row";

/**
 * 首页的快捷新建目标。
 *
 * 分类与字段统一读 `lib/life-fields.ts` 的 CATEGORY_FIELDS —— 以前这里自带一套
 * 硬编码字段（事业/技能/健康/旅行/财富/生活），且除旅行外全被拍平成
 * 「标签: 值」塞进 description，结构化数据全丢。现在按分类落到真正的列/custom_fields。
 */

const INPUT_CLASS =
  "w-full rounded-[10px] border border-border bg-surface-elevated px-3 py-2 text-[13px] text-text placeholder:text-text-tertiary focus:border-primary/40 focus:outline-none";

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

  const catMeta = CATEGORY_META[category] ?? CATEGORY_META.other;
  const categoryFields = getCategoryFields(category);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const raw: Record<string, string> = {};
      for (const field of categoryFields) {
        raw[field.key] = dynamicFields[field.key] ?? "";
      }
      const { columns, customFields } = buildCategoryValues(categoryFields, raw);

      const payload: LifeGoalInput = {
        title: title.trim(),
        category,
        difficulty: 3,
        ...columns,
      };
      if (Object.keys(customFields).length > 0) {
        payload.customFields = customFields;
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
          className="-mr-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-elevated/70 hover:text-primary"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showForm ? "取消" : t("dashboard.addGoal")}</span>
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[14px] border border-border-subtle bg-surface p-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={`输入你的${catMeta.labelZh}目标...`}
                autoFocus
                className={INPUT_CLASS}
              />

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => handleCategoryChange(key)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] transition-colors ${
                      category === key
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "bg-surface-elevated text-text-tertiary hover:bg-surface-muted"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    {meta.labelZh}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {categoryFields.map((field) => (
                  <div
                    key={field.key}
                    className={field.type === "textarea" ? "sm:col-span-2" : undefined}
                  >
                    <label className="mb-1 block text-[11px] text-text-tertiary">
                      {field.label}
                      {field.required && <span className="ml-1 text-danger">*</span>}
                      {field.unit && <span className="ml-1">（{field.unit}）</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={dynamicFields[field.key] ?? ""}
                        onChange={(e) =>
                          setDynamicFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">未选择</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        rows={2}
                        value={dynamicFields[field.key] ?? ""}
                        onChange={(e) =>
                          setDynamicFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className={INPUT_CLASS}
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={dynamicFields[field.key] ?? ""}
                        onChange={(e) =>
                          setDynamicFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                ))}
              </div>

              {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="mt-3 w-full rounded-[10px] bg-primary py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "创建中..." : `创建${catMeta.labelZh}目标`}
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
