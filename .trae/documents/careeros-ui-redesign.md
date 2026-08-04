# CareerOS 整体视觉重构方案

## Context

当前 CareerOS 前端 UI 像企业后台：左侧固定 Sidebar + 顶部 Header + 大量紫色渐变 Card，缺乏人格与情绪。用户要求把「年轻人的人生操作系统」这一产品定位落实到视觉层：Floating Navigation + Spacious Canvas + 深色背景 + Editorial 字体 + 微交互。

本次是 **UI/UX 重构，不删功能、不改后端 API、不动数据库**。现有 16 个路由、所有业务逻辑、auth/middleware 全部保留。按 Phase 1-7 分阶段执行，每个 Phase 完成后验证再进入下一个。

---

## 关键决策（已与用户确认）

1. **路由分组**：16 个路由全部分入 NOW / GROW / CAREER 三组（无折叠/隐藏）
   - **NOW**（当下）：`/dashboard`、`/life`、`/life/map`、`/life/records`（4 项）
   - **GROW**（成长）：`/skills`、`/planner`、`/coach`、`/explore`、`/library`、`/projects`（6 项）
   - **CAREER**（职业）：`/resume`、`/interviews`、`/jobs`、`/salary`、`/analytics`（5 项）
   - **Footer**：`/settings`

2. **Dashboard 旧模块**：新 7 个 section 在顶部，旧的 4 个模块（趋势折线图、学习日历热力图、AI 建议卡、任务列表）**保留在 dashboard 底部**继续展示。

3. **暗色模式**：dark-first，`defaultTheme="dark"`，但保留 header 切换按钮（不删功能）。

4. **新模块无后端 API 的兜底**：Mood 用 localStorage；LifeStats 复用现有 `/life/dashboard` + `/life/checkin` + `/life/map` 三个 API 聚合，`daysActive` 暂用 `totalCheckins` 兜底并标 TODO。

---

## Phase 1：UI Audit（已完成，无代码改动）

审计结论见下方「现状关键发现」表。无需提交。

---

## Phase 2：Design System 基础

### 改 `apps/web/app/globals.css`
- `:root` 重定义为 dark-first 值（`--background:#09090B`、`--surface:#111114`、`--surface-elevated:#16161A`、`--text:#F5F5F7`、`--text-secondary:#8E8E99`、`--primary:#8B5CF6`、`--primary-glow:#C084FC`、`--info:#22D3EE` 等）
- `.light` 反向覆盖（保留切换能力）
- `@theme inline` 同步新增 `--color-surface-elevated` `--color-text-secondary` `--color-text-tertiary` `--color-primary-glow` `--color-info`
- `body` 字体栈改为 `var(--font-inter), "PingFang SC", "Noto Sans SC", ...`
- `body` radial-gradient 透明度降到 0.08/0.06/0.05（克制）
- 改 `.glass`（更轻：surface 72% + blur 24px）、`.text-gradient`（白紫青 editorial）、`.soft-shadow`、`.ring-glow`
- 新增工具类：`.noise`（极轻噪点）、`.ambient-glow`、`.editorial`、`.hairline`、`.font-display`、`.font-manrope`、`.font-mono-num`

### 改 `apps/web/app/layout.tsx`
- 引入 `next/font/google` 的 `Inter`、`Space_Grotesk`、`Manrope`，分别注入 `--font-inter` `--font-display` `--font-manrope` 变量到 `<html>` className
- `<html>` 加 `className="dark"` 作 SSR 默认
- `viewport.themeColor` 改 `#09090B`

### 改 `apps/web/components/providers.tsx`
- `ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}`

### 改 `apps/web/components/ui.tsx`
- `Button` default variant 去紫色大渐变，改 `bg-surface-elevated text-text border border-border-subtle hover:border-primary/40`；新增 `variant: "primary"` 仅关键 CTA 用紫色
- `Card` 默认 `bg-surface/60 border-border-subtle`
- `StatCard` 移除右上紫色 blur，数字用 `font-display`
- `SectionHeader` 支持 `editorial` prop（`font-display tracking-tight uppercase text-[11px] text-text-secondary`）

### 验证
`npm run dev` → `/dashboard` 应为深色背景；DevTools 看 body font-family 首项为 next/font 哈希类名；切 theme toggle 应切到 light；`npm run typecheck` 通过。

---

## Phase 3：Sidebar 重做（最重要）

### 新建 `apps/web/components/sidebar/sidebar-nav.tsx`
主体：Logo（✦ CareerOS + YOUR LIFE OS）+ 三个分组（NOW/GROW/CAREER）+ footer settings。宽度由 `useSidebarWidth` 控制。

### 新建 `apps/web/components/sidebar/sidebar-nav-item.tsx`
单 item，active 状态实现：
- 左侧 2px accent line，用 `motion.span layoutId="sidebar-active-line"` 在 item 间滑动
- `bg-gradient-to-r from-primary/8 to-transparent`（极轻微，非大矩形）
- icon `drop-shadow-[0_0_6px_var(--primary-glow)]` glow
- 文字 active 时 `text-text`，inactive 时 `text-text-secondary`

### 新建 `apps/web/components/sidebar/sidebar-profile.tsx`
头像 + 名字 + `LEVEL 03` + 细进度条 + `27 DAYS ACTIVE`。数据来自 `/profile` + `getLifeDashboard`。

### 新建 `apps/web/components/sidebar/use-sidebar-width.ts`
状态机 hook：`"expanded" | "compact" | "hovering"`。desktop 默认 expanded，tablet(768-1024) 永久 compact+hover 展开，mobile(<768) 不渲染。偏好持久化到 `localStorage: career_os_sidebar_compact`。width transition 用 `transition-[width] duration-200 ease-out`。

### 新建 `apps/web/components/sidebar/index.ts`
barrel export。

### 改 `apps/web/components/app-shell.tsx`
- 移除 L87-131 内联 sidebar 代码，替换为 `<Sidebar />`
- 移除 L217-245 底部 nav，Phase 6 替换为 `<BottomNav />`
- header 搜索 placeholder 改 `t("dashboard.searchLife")`
- header 右侧 icon 改纯线性（去 `hover:bg-surface-muted`，改 `hover:text-text`）
- nav 数组 L54-74 的 `group` 字段值改为 `"now" | "grow" | "career" | "system"`

### 改 `apps/web/lib/i18n.tsx`
`nav` 新增键：`now`/`grow`/`careerGroup`（zh: 当下/成长/职业，en: NOW/GROW/CAREER）。保留旧 `overview/lifeGoals/careerPlan/system` 键兼容。

### 改 `apps/web/components/brand-mark.tsx`
新增 `variant: "text"` 渲染 `✦ CareerOS` + 下方小字 `YOUR LIFE OS`，保留图片 variant 兼容现有引用。

### 验证
desktop sidebar 224px，hover item 有 accent line 滑动；tablet 64px compact hover 展开；mobile 隐藏；刷新后偏好持久化；16 个路由点击 active 正确；`npm run lint` 通过。

---

## Phase 4：Dashboard 重做

### 新建组件（`apps/web/components/dashboard/`）

| 文件 | 职责 | 数据来源 |
|---|---|---|
| `hero.tsx` | 动态问候 GOOD MORNING/AFTERNOON/EVENING + 名字 + 人生格言 + Edit icon + ambient glow | `useQuery(["life-profile"])` `/profile`；hour 来自 `new Date().getHours()` |
| `streak-card.tsx` | 🔥 07 DAYS KEEP GOING + M T W T F S S 圆点 + 中文副标题 + 数字 count-up | `useQuery(["life-checkin"])` 复用 `getCheckinStreak` |
| `active-goals.tsx` | YOUR LIFE RIGHT NOW / ACTIVE GOALS + 列表 + ＋Add goal | `useQuery(["life-goals"])` 复用 `getLifeGoals`，过滤非 completed 取前 5 |
| `goal-row.tsx` | 单行：序号 01 + 标题 + 进度条 + 百分比，进度条 width 动画 | props 接收 goal |
| `life-map-preview.tsx` | YOUR LIFE MAP + 380px 地图 + marker 弹窗(Tokyo/FIRST SOLO TRIP/2026.04) | `useQuery(["life-map"])` 复用 `getLifeMap`，传给 `LifeMapClient` |
| `mood-picker.tsx` | TODAY'S MOOD + 5 emoji 😵😐🙂😎✨ + 选中显示"今天还不错" | `localStorage: career_os_mood_${YYYY-MM-DD}`，无 API |
| `life-stats.tsx` | 4 大数字 + "You're becoming someone." | 聚合 `/life/dashboard` + `/life/checkin` + `/life/map`，`daysActive` 暂用 `totalCheckins` 兜底标 TODO |
| `index.ts` | barrel | - |

### 改 `apps/web/app/(app)/dashboard/page.tsx`
section 排列顺序：
1. OnboardingBanner（保留，条件显示）
2. Hero（新）
3. StreakCard（新）
4. ActiveGoals（新）
5. LifeMapPreview（新）
6. MoodPicker（新）
7. LifeStats（新）
8. **趋势折线图（保留，移到底部）**
9. **学习日历热力图（保留，移到底部）**
10. **AI 建议卡（保留，移到底部）**
11. **任务列表（保留，移到底部）**

保留所有现有 react-query hooks，新增 `useQuery(["life-goals"])`、`useQuery(["life-map"])`、`useQuery(["life-profile"])`、`useQuery(["life-checkin"])`。整体宽度 `max-w-[1100px]` 更聚焦，section 间 `mt-10`。删除 4 个 StatCard 网格（其数据已在 LifeStats 体现）。

### 改 `apps/web/components/ui.tsx`
`SectionHeader` 支持 `editorial` prop。

### 验证
7 新 section 按序排列；Hero 问候随时间变；StreakCard 数字来自 API；ActiveGoals 来自 `/life/goals`；LifeMapPreview 渲染 markers；MoodPicker 刷新后状态保留；LifeStats 4 数字来自聚合 API；底部 4 旧模块仍展示；`npm run build` 通过。

---

## Phase 5：Micro Interaction

### 新建 `apps/web/lib/motion.ts`
导出 `fadeUp`、`scaleIn`、`staggerContainer`、`useCountUp`（从 `life-progress-card.tsx` 抽出）、`useMagnetic` 等 framer-motion variants 与 helper。

### 新建 `apps/web/lib/hooks/use-magnetic.ts`
Button magnetic hover（基于 mousemove + spring）。

### 改各组件加动画
- `sidebar-nav-item.tsx`：active line `layoutId` 滑动（已在 Phase 3 实现）
- `goal-row.tsx`：进度条 `motion.div animate={{ width }}`
- `streak-card.tsx`：数字 count-up
- `mood-picker.tsx`：选中 scale + glow
- `ui.tsx` `Button`：新增 `magnetic` prop 挂 `useMagnetic`
- `life-map-view.tsx`：marker hover `transform 0.2s` via leaflet divIcon
- `app/(app)/layout.tsx`：包 `<motion.main>` + `AnimatePresence` + `usePathname` 做 page transition
- AI Coach loading：复用现有 `assistant-progress.tsx`，加 glow pulse

所有动画 150-300ms ease-out。

### 验证
sidebar active line 滑动 200ms；GoalRow 进度条 width 动画；StreakCard count-up；MoodPicker scale+glow；Button magnetic 位移；page transition fade；DevTools Performance 录制无丢帧。

---

## Phase 6：Responsive

### 新建 `apps/web/lib/hooks/use-media-query.ts`
SSR 安全的 `useMediaQuery`。

### 新建 `apps/web/lib/hooks/use-is-client.ts`
解决 next-themes hydration。

### 改 `apps/web/components/sidebar/use-sidebar-width.ts`
监听 `(max-width:1024px)` tablet 自动 compact，`(max-width:768px)` mobile 隐藏。

### 新建 `apps/web/components/mobile/bottom-nav.tsx`
重新设计底部 nav：5 item（Home/Life/Coach/Map/Profile），Profile 点击开抽屉含 settings/theme/language/signOut。`padding-bottom: env(safe-area-inset-bottom)`。选中态 icon 上方 2px accent line + `motion.div layoutId="bottom-nav-active"`。

### 改 `apps/web/components/app-shell.tsx`
移除旧底部 nav，替换 `<BottomNav />`；mobile header 透明 + hamburger。

### 验证
DevTools Device 测 375/768/1280；375px 底部 nav 5 item 无 sidebar；768px sidebar compact 64px hover 展开；1280px sidebar 224px；iPhone safe area 不被遮挡；PWA standalone 模式正常。

---

## Phase 7：Visual QA（无代码改动）

- `npm run lint && npm run typecheck && npm run build` 全绿
- 逐页截图（dashboard/life/lifeMap/skills/coach/settings）比对设计
- 切 light 模式逐页检查透明度可读性
- Lighthouse Performance ≥85、Accessibility ≥95
- 真机 iPhone Safari + Android Chrome 验证

---

## 不做的事（边界）

- 不删任何路由/API/数据库表/业务逻辑
- 不改 `apps/api`、`packages/*` 后端
- 不删 `LifeGoalBoard`/`CheckinStreakCard`/`LifeLevelCard` 等现有组件（其它页面引用）
- 不删 echarts/react-leaflet 依赖
- 不引入新 UI 库（shadcn/radix），保持 cva + tailwind
- 不改 `lib/supabase.ts`、`lib/api.ts`、`middleware.ts`

---

## 关键文件索引

- `apps/web/app/globals.css` — Design System 核心，所有 token 定义
- `apps/web/components/app-shell.tsx` — Sidebar 拆分 + 响应式中枢（L87-131 sidebar、L217-245 底部 nav）
- `apps/web/app/(app)/dashboard/page.tsx` — Dashboard 重写主战场
- `apps/web/components/ui.tsx` — Button/Card/StatCard/SectionHeader 原语
- `apps/web/lib/i18n.tsx` — 新分组键 + dashboard 文案键

## 执行顺序

Phase 2 → (Phase 3 ∥ Phase 4) → Phase 5 → Phase 6 → Phase 7。Phase 3 与 4 都依赖 Phase 2 token，可并行。
