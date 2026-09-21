import type { LifeGoalInput } from "@/lib/life";

/**
 * 人生目标的「分类 → 字段」单一配置源。
 *
 * 新建表单与（后续的）详情页都读这一份，改字段只改这里。
 * `column` 指向 life_goals 里已有的列，值直接落列；
 * 没写 `column` 的字段统一落 `life_goals.custom_fields`（JSON）。
 *
 * 注意：`required` 只用于界面标红提示，**不拦截提交**
 * —— 老目标、AI 生成目标、外部调用都可能缺字段，硬拦会 400/422。
 */

export type FieldType = "text" | "number" | "select" | "textarea" | "tags";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** 输入框右侧/下方的单位提示，如「元」「小时」 */
  unit?: string;
  /** type = select 时的选项 */
  options?: string[];
  /** 命中 life_goals 已有列时填列名（camelCase，与 LifeGoalInput 一致） */
  column?: keyof LifeGoalInput;
}

/**
 * 通用字段：所有分类共用，渲染位置固定（见 life-goal-board 的 CreateGoalForm）
 * ——「地点」也算通用：它带经纬度、喂人生地图，不该只在旅行分类出现。
 */
const COMMON_BEFORE: FieldSpec[] = [];
const COMMON_AFTER: FieldSpec[] = [
  { key: "description", label: "描述", type: "textarea", column: "description", placeholder: "想清楚为什么做这件事，三个月后回来看" },
];

const TRAVEL_FIELDS: FieldSpec[] = [
  { key: "departure_city", label: "出发地", type: "text", placeholder: "如：北京" },
  { key: "travelers", label: "出行人数", type: "number", placeholder: "如 2" },
  { key: "friends", label: "同行好友", type: "tags", column: "friends", placeholder: "多人用、隔开，如 小王、老李" },
  { key: "budget", label: "预算", type: "text", column: "budget", placeholder: "如 10000", unit: "元" },
  { key: "recommended_days", label: "推荐天数", type: "number", column: "recommendedDays", placeholder: "如 10", unit: "天" },
  { key: "best_season", label: "最佳季节", type: "text", column: "bestSeason", placeholder: "如 6-9月" },
  { key: "region", label: "地区 / 大区", type: "text", column: "region", placeholder: "如 中国西南" },
  {
    key: "interests",
    label: "兴趣偏好",
    type: "tags",
    placeholder: "自然风光、美食、人文、摄影、户外…（用、隔开）",
  },
];

const CAREER_FIELDS: FieldSpec[] = [
  { key: "target_role", label: "目标岗位", type: "text", required: true, placeholder: "如：市场运营经理" },
  { key: "target_company", label: "目标公司 / 行业", type: "text", placeholder: "如：生物医药 / 消费品牌" },
  { key: "key_results", label: "关键结果", type: "textarea", placeholder: "最多 3 条，如：独立操盘一场 GMV 50w 的直播" },
  { key: "current_gap", label: "当前差距", type: "textarea", placeholder: "缺什么经验 / 证书 / 作品" },
  { key: "resources", label: "需要的资源 / 支持", type: "text", placeholder: "内推、导师、课程…" },
  { key: "metric", label: "衡量标准", type: "text", placeholder: "如：拿到 2 个 offer" },
  { key: "budget", label: "预算", type: "text", column: "budget", placeholder: "课程 / 证书 / 简历开销", unit: "元" },
];

const SKILL_FIELDS: FieldSpec[] = [
  { key: "skill_name", label: "技能名称", type: "text", required: true, placeholder: "如：英语口语" },
  { key: "current_level", label: "当前等级", type: "number", placeholder: "1-5", unit: "级" },
  { key: "target_level", label: "目标等级", type: "number", placeholder: "1-5", unit: "级" },
  { key: "weekly_hours", label: "每周投入", type: "number", placeholder: "如 5", unit: "小时" },
  { key: "learning_path", label: "学习方式 / 课程", type: "text", placeholder: "如：影子跟读 + 每周外教 1 次" },
  { key: "evidence", label: "验收标准", type: "text", placeholder: "如：能无字幕看美剧" },
  { key: "budget", label: "预算", type: "text", column: "budget", placeholder: "课程 / 工具开销", unit: "元" },
];

const HEALTH_FIELDS: FieldSpec[] = [
  {
    key: "metric_type",
    label: "健康指标",
    type: "select",
    required: true,
    options: ["体重", "体脂", "睡眠", "跑步", "血压", "自定义"],
  },
  { key: "target_value", label: "目标值", type: "number", required: true, placeholder: "如 65" },
  { key: "start_value", label: "起始值", type: "number", placeholder: "如 72（用来自动画进度条）" },
  { key: "unit", label: "单位", type: "select", options: ["kg", "%", "小时", "km", "次/分"] },
  { key: "frequency", label: "打卡频率", type: "select", options: ["每日", "每周 3 次", "每周 1 次"] },
  { key: "current_habit", label: "当前习惯", type: "text", placeholder: "如：每周跑 1 次" },
  { key: "obstacles", label: "障碍", type: "text", placeholder: "如：晚上加班吃夜宵" },
];

const RELATIONSHIP_FIELDS: FieldSpec[] = [
  { key: "person", label: "关系对象", type: "text", required: true, placeholder: "如：父母 / 伴侣 / 老同学" },
  { key: "action_type", label: "关系动作", type: "select", options: ["陪伴", "沟通", "共同经历", "和解"] },
  { key: "frequency", label: "频率", type: "select", options: ["每周一次", "每月一次", "只做一次"] },
  { key: "budget", label: "预算", type: "text", column: "budget", placeholder: "如 12000", unit: "元" },
];

const FINANCE_FIELDS: FieldSpec[] = [
  { key: "kind", label: "类型", type: "select", required: true, options: ["储蓄", "投资", "还债", "收入提升"] },
  { key: "target_amount", label: "目标金额", type: "number", required: true, placeholder: "如 100000", unit: "元" },
  { key: "current_amount", label: "当前金额", type: "number", placeholder: "如 32000", unit: "元" },
  { key: "monthly_amount", label: "每月可投入", type: "number", placeholder: "如 3000", unit: "元" },
  { key: "risk_level", label: "风险偏好", type: "select", options: ["保守", "稳健", "进取"] },
];

/** 其他目标 & 自定义分类：不硬塞专属字段，只留一条备注 */
const OTHER_FIELDS: FieldSpec[] = [
  { key: "note", label: "备注", type: "textarea", placeholder: "这个目标还想补充点什么" },
];

export const CATEGORY_FIELDS: Record<string, FieldSpec[]> = {
  travel: TRAVEL_FIELDS,
  career: CAREER_FIELDS,
  skill: SKILL_FIELDS,
  health: HEALTH_FIELDS,
  relationship: RELATIONSHIP_FIELDS,
  finance: FINANCE_FIELDS,
  other: OTHER_FIELDS,
};

/** 未知的自定义分类走其他目标的字段集 */
export function getCategoryFields(category?: string | null): FieldSpec[] {
  return CATEGORY_FIELDS[category || "other"] ?? OTHER_FIELDS;
}

export function getCommonFields(): { before: FieldSpec[]; after: FieldSpec[] } {
  return { before: COMMON_BEFORE, after: COMMON_AFTER };
}

/** 把持久化的值转成输入框字符串 */
export function toInputValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

/** 标签类字段：中文顿号 / 中英文逗号 / 空白 都当分隔符 */
export function splitTags(value: string): string[] {
  return value
    .split(/[、,，;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 把某个分类的输入收成 { 列值, customFields } */
export function buildCategoryValues(
  fields: FieldSpec[],
  raw: Record<string, string>,
): { columns: Partial<LifeGoalInput>; customFields: Record<string, unknown> } {
  const columns: Partial<LifeGoalInput> = {};
  const customFields: Record<string, unknown> = {};

  for (const spec of fields) {
    const text = (raw[spec.key] ?? "").trim();
    if (!text) continue;

    let value: unknown = text;
    if (spec.type === "tags") value = splitTags(text);
    else if (spec.type === "number") {
      const num = Number(text);
      if (!Number.isFinite(num)) continue;
      value = num;
    }
    if (Array.isArray(value) && value.length === 0) continue;

    if (spec.column) {
      (columns as Record<string, unknown>)[spec.column] = value;
    } else {
      customFields[spec.key] = value;
    }
  }

  return { columns, customFields };
}

/** 详情页/卡片展示：把 customFields 按分类字段定义翻译成「标签 + 值」 */
export function describeCustomFields(
  category: string | null | undefined,
  customFields: Record<string, unknown> | null | undefined,
): Array<{ key: string; label: string; value: string; unit?: string }> {
  if (!customFields) return [];
  const specs = getCategoryFields(category);
  const out: Array<{ key: string; label: string; value: string; unit?: string }> = [];

  for (const spec of specs) {
    if (spec.column) continue; // 列字段有单独的徽标展示
    const value = customFields[spec.key];
    if (value == null || value === "") continue;
    out.push({ key: spec.key, label: spec.label, value: toInputValue(value), unit: spec.unit });
  }

  // 配置里没登记的历史字段也照常显示，不丢数据
  const known = new Set(specs.map((spec) => spec.key));
  for (const [key, value] of Object.entries(customFields)) {
    if (known.has(key) || value == null || value === "") continue;
    out.push({ key, label: key, value: toInputValue(value) });
  }
  return out;
}
