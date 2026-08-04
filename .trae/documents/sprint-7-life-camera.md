# Sprint 7 — Life Camera（AI 相机 / 连续打卡 / 视频日志）

> 项目：AI LifeOS ｜ 基线：HEAD `566c0ac`（Sprint 6 Life Map 完整）｜ 完成后停止，等待 Sprint 8 Life Social。

## Summary

打造 AI LifeOS 的「记录中心」。一次相机操作即可串联：拍照/录像 → GPS/时间/天气/海拔 → LifeOS 水印 → AI 识别场景 → 生成记录 → 更新地图 Marker → 连续打卡 → 更新 XP → 参与 Year Review。

新增 3 个页面（`/life/camera`、`/life/checkin`、`/life/video`），2 个 AI 接口（`POST /ai/photo-analysis`、`POST /ai/journal`），1 个连续打卡模块（`checkin_streaks` 表 + 服务），视频日志支持（扩展 `LifeRecord`），以及完整的相机前端（getUserMedia + MediaRecorder + 水印 + 快门动画 + 上传进度）。

## Current State Analysis

**工作区损坏，需先恢复（用户已确认）**：当前工作区把 Sprint 5.5（bucket）与 Sprint 6（life-map）约 6046 行代码未提交地删除了——`models.py` 里的 `BucketItem/LifeMapVisit/UserBucketItem/BucketCategory` 被删、bucket 域与 life-map 页面/组件/lib、两个迁移、相关测试全部 `D`，但 `life/service.py` 仍 `import BucketItem, LifeMapVisit, UserBucketItem` → **API 当前无法 import 启动**。HEAD `566c0ac` 是完整且正确的 Sprint 6 基线。

**HEAD 基线已有能力（Sprint 7 直接复用，无需重建）**：
- `LifeRecord` 模型已含 `record_type / photo_url / watermark_url / latitude / longitude / city / country / weather / altitude / device_info`。
- `LifeRecordService.create` 走 `UploadFile` + `Form()` + Supabase `life-records` bucket 上传（`app/core/storage.py`）。
- `LifeMapService` 已聚合 `LifeRecord`（带坐标）→ 地图 Marker；`LifeMapVisit / LifeGoal / BucketItem` 也已聚合。**视频记录只要带坐标即自动成为 Marker**。
- `YearSummaryService._records` 已遍历用户记录参与年度总结。
- `UserLevelRepository` + `LifeGoalService.award_xp` 已实现 XP/等级。
- AI 侧 `AIService.generate_content`（`app/domains/ai/service.py`）+ prompt 文件 + `extract_json` + 7 个 AI 路由的成熟模式。
- 前端 `apiFetch`（自动 `Bearer dev` + FormData 透传）、`lib/life.ts`、`components/life/watermark-canvas.ts`、`lib/location.ts`、`components/life/review/count-up.tsx`、`components/ui.tsx`（Button/Card/Textarea/Badge/StatCard/EmptyState/Skeleton）。

**关键约束（来自 project_memory）**：AI 走 `async/await`；AI 输出必须校验并 fallback；测试环境 `APP_ENV=test` 关闭限流、用 `MockAIProvider`（返回非 JSON 文本 → `extract_json` 返回 None → 必须走 fallback）。

## Assumptions & Decisions

1. **AI「场景识别」为上下文驱动，非真实视觉**：现有 `AIProvider.complete()` 仅接收文本 messages、返回 str（无多模态）。本 Sprint 不重构 Provider 接口。`/ai/photo-analysis` 将把「照片上下文」（GPS、逆地理/地点、时间、天气、海拔、关联目标标题、可选 caption）喂给 AI 推断场景类型/标签/描述/推荐 Bucket/Goal，并可选生成旅行/成长记录片段。这是对架构诚实的实现；真实图像视觉留作未来增强（需扩展 AIProvider 支持 image content parts）。
2. **天气/温度为客户端可选传入**：浏览器 Geolocation 仅稳定提供 `altitude`。为遵守「测试不依赖外部 API」约定，不接入实时天气 API；`weather/temperature` 作为可选 Form 字段由前端传入（缺省 None），后续可插拔天气 Provider。`altitude` 由 Geolocation `coords.altitude` 提供。
3. **连续打卡自动 + 手动**：创建 LifeRecord 时自动触发当日打卡（当天首次记录 +1，同日幂等）；另暴露 `GET/POST /life/checkin` 供首页展示与手动补签。
4. **视频压缩在前端**：用 `MediaRecorder` 录制 + 限制时长（30/60/180s）+ `canvas` 抽首帧作封面；后端不做转码（无 ffmpeg 依赖），原片上传 Supabase。
5. **MockAIProvider 返回非 JSON → 所有新 AI 服务必须 `try/except AppError → fallback`**（沿用 `BucketRecommendationService` 模式），保证测试离线可跑。

## Proposed Changes

### Step 0 — 恢复工作区到 HEAD（执行前置，用户已确认）

```bash
git restore .
git restore :/      # 恢复已删除文件（D 状态）
git status          # 确认干净，HEAD=566c0ac
```
随后 `python -c "import app.main"` 可正常导入（在 `apps/api`）。

### Backend — 数据库与迁移

**`apps/api/app/db/models.py`**
- 扩展 `LifeRecord`（在 `altitude` 后、`device_info` 前追加）：
  - `video_url: Mapped[str | None] = mapped_column(Text)`
  - `thumbnail_url: Mapped[str | None] = mapped_column(Text)`
  - `duration_seconds: Mapped[int | None] = mapped_column(Integer)`
  - `scene_type: Mapped[str | None] = mapped_column(String(40))`
  - `ai_tags: Mapped[list[str]] = mapped_column(JSON, default=list)`
  - `ai_description: Mapped[str | None] = mapped_column(Text)`
  - `temperature: Mapped[float | None] = mapped_column(Float)`
  - `bucket_item_id: Mapped[str | None] = mapped_column(ForeignKey("bucket_items.id", ondelete="SET NULL"), index=True)`
- 新增模型（置于 `LifeMapVisit` 之后）：
  ```python
  class CheckinStreak(Base):
      __tablename__ = "checkin_streaks"
      __table_args__ = (UniqueConstraint("user_id", name="uq_checkin_streaks_user"),)
      id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
      user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True, unique=True)
      current_streak: Mapped[int] = mapped_column(Integer, default=0)
      longest_streak: Mapped[int] = mapped_column(Integer, default=0)
      last_checkin_date: Mapped[date | None] = mapped_column(Date)
      total_checkins: Mapped[int] = mapped_column(Integer, default=0)
      updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)
  ```

**`apps/api/migrations/versions/c7d8e9f0a1b2_add_life_camera_streak.py`**（`down_revision = "b2c3d4e5f6a7"`）
- `op.add_column("life_records", ...)` ×8（上述新字段）
- `op.create_index("ix_life_records_bucket_item_id", ...)`
- `op.create_table("checkin_streaks", ...)` + `uq_checkin_streaks_user`

### Backend — Life 域（Repository / Service / Router / Schema）

**`apps/api/app/domains/life/repository.py`**
- `LifeRecordRepository.create`：已是 `**values` 透传，新字段自动支持（无需改签名）。
- 新增 `CheckinStreakRepository(BaseRepository[CheckinStreak])`：`get_by_user`、`create(user_id)`、`upsert`（由 service 编排，repository 只管持久化）。

**`apps/api/app/domains/life/schemas.py`**
- 扩展 `LifeRecordListItem` / `LifeRecordDetailResponse`：`videoUrl, thumbnailUrl, durationSeconds, sceneType, aiTags, aiDescription, temperature, bucketItemId`。
- 新增 `CheckinStreakResponse(BaseModel)`：`currentStreak, longestStreak, lastCheckinDate, totalCheckins, checkedInToday`（camelCase via `to_camel`）。

**`apps/api/app/domains/life/service.py`**
- `life_record_dict`：补 8 个新字段。
- `XP_PER_RECORD = {"photo": 10, "video": 20, "text": 5}`（模块常量）。
- `LifeRecordService.create` 扩展签名：新增 `video_file, thumbnail, duration_seconds, scene_type, ai_tags, temperature, bucket_item_id` 形参；视频走 `upload_record_file` 改路径前缀 `{user_id}/{goal_id}/video/{filename}`；图片仍走 `watermark/`。创建成功后：
  - `self._award_record_xp(user_id, record_type)`（复用 `UserLevelRepository`，公式同 `LifeGoalService.award_xp`）。
  - `CheckinStreakService(db).checkin(user_id)`（当天首次记录自动打卡）。
- 新增 `CheckinStreakService`：
  - `get(user_id) -> dict`：无则返回零值 `{currentStreak:0, longestStreak:0, lastCheckinDate:None, totalCheckins:0, checkedInToday:False}`。
  - `checkin(user_id, today=None) -> dict`：`today = today or date.today()`；取/建行；`if last==today: 幂等返回`；`elif last==yesterday: current+=1`；`else: current=1`；`longest=max(longest,current)`；`last=today; total+=1`；commit；返回 dict（`checkedInToday=True`）。

**`apps/api/app/domains/life/router.py`**
- 扩展 `create_life_record`：新增 Form 字段 `video: UploadFile|None=None, thumbnail: UploadFile|None=None, duration_seconds: int|None=None, scene_type: str|None=None, ai_tags: str|None=None(JSON 字符串), temperature: float|None=None, bucket_item_id: str|None=None`；`record_type` 默认仍 `"photo"`，视频传 `"video"`。`ai_tags` 在 service 内 `json.loads`（失败回退 `[]`）。
- 新增 `GET /life/checkin` → `CheckinStreakService.get`。
- 新增 `POST /life/checkin` → `CheckinStreakService.checkin`（手动补签，同日幂等）。

### Backend — AI 域（photo-analysis / journal）

**`apps/api/app/domains/ai/prompts/photo_analysis.py`**（新）：`PHOTO_ANALYSIS_PROMPT`，输入 `{location_text, captured_at, weather, altitude, goal_title, caption}`，要求严格输出 JSON `{scene_type, suggested_tags:[], description, recommended_buckets:[], recommended_goals:[], journal?:{title,content,reflection,keywords:[]}}`。

**`apps/api/app/domains/ai/prompts/journal.py`**（新）：`JOURNAL_PROMPT`，输入 `{record_type, content, location, weather, goal_title, captured_at}`，输出 `{title, content, reflection, keywords:[]}`。

**`apps/api/app/domains/ai/schemas.py`**
- `PhotoAnalysisRequest`：`latitude, longitude, altitude?, capturedAt(str), weather?, temperature?, goalId?, caption?`（camelCase + `AliasChoices`）。
- `PhotoAnalysisResponse`：`sceneType, suggestedTags:list[str], description:str, recommendedBuckets:list[str], recommendedGoals:list[str], journal:dict|None`。
- `JournalRequest`：`recordId?` 或 `{recordType, content?, location?, weather?, goalTitle?, capturedAt?}`。
- `JournalResponse`：`title, content, reflection, keywords:list[str]`。

**`apps/api/app/domains/ai/service.py`**
- `PhotoAnalysisService(db)`：`__init__` 装配 `AIService + LifeGoalRepository + BucketItemRepository`；`analyze(user_id, payload)`：
  - 若 `goalId` 给定，校验归属并取 `goal.title`。
  - `location_text` 由 `latitude/longitude` 拼成可读串（无逆地理时用坐标）。
  - 调 `ai.generate_content(content_type="photo_analysis", ...)`；**`try/except AppError → fallback`**：fallback `sceneType="未识别", suggestedTags=[], description="（AI 暂不可用）", recommendedBuckets=[], recommendedGoals=[], journal=None`。
  - 返回 `PhotoAnalysisResponse`。
- `JournalService(db)`：`generate(user_id, payload)`：若 `recordId` 给定则取该记录上下文；调 AI；**fallback**：`title="今日记录", content=payload 内容或"（无）", reflection="", keywords=[]`。

**`apps/api/app/domains/ai/router.py`**
- `POST /ai/photo-analysis, response_model=PhotoAnalysisResponse` → `PhotoAnalysisService.analyze`。
- `POST /ai/journal, response_model=JournalResponse` → `JournalService.generate`。

### Backend — Year Review 联动（小改）

**`apps/api/app/domains/ai/service.py`（`YearSummaryService`）**：`_records` 传入 AI 的 record 行追加 `record_type`，使「年度照片/年度视频」可被区分；`memories` 中带 `recordType`。仅扩展 dict 字段，不破坏现有契约。

### Frontend — lib 与水印

**`apps/web/lib/location.ts`**：`GeoLocation` 增加 `altitude?: number|null; accuracy?: number`；`getCurrentLocation` 返回 `coords.altitude/accuracy`。

**`apps/web/components/life/watermark-canvas.ts`**：扩展 `WatermarkMeta`（`weather?, temperature?, altitude?, city?, country?, gps?`）+ 新 `WatermarkConfig`（各项布尔开关，默认全开）；`createWatermarkImage(file, meta, config?)` 按开关渲染：日期、时间、地点、城市、国家、GPS、天气、温度、海拔、LifeOS Logo。视频用首帧 canvas 截图同流程生成水印封面。

**`apps/web/lib/life.ts`**：扩展 `LifeRecord` interface 8 字段；`createLifeRecord` 增参 `{ recordType?, video?, thumbnail?, durationSeconds?, sceneType?, aiTags?, temperature?, bucketItemId? }`，按 `recordType` 决定 append `file`（图片水印后）或 `video`。

**`apps/web/lib/camera.ts`**（新，统一 lib，禁止页面直接 fetch）：
- `analyzePhoto(payload: PhotoAnalysisRequest): Promise<PhotoAnalysisResponse>`
- `generateJournal(payload: JournalRequest): Promise<JournalResponse>`
- `getCheckinStreak(): Promise<CheckinStreakResponse>`
- `triggerCheckin(): Promise<CheckinStreakResponse>`
- `getVideoRecords(page?): Promise<LifeRecordListResponse>`（复用 `getLifeRecords` 过滤 recordType=video，或直接调 `getLifeRecords` 前端过滤）

### Frontend — 相机组件（`apps/web/components/life/camera/`，新）

- `ai-camera.tsx`：核心相机。`getUserMedia({video:{facingMode}, audio:true})` 实时预览；拍照（`canvas.drawImage` → `createWatermarkImage`）；录像（`MediaRecorder`，按 30/60/180s 停止）；`facingMode` 前/后切换；`torch` 闪光（能力检测）；网格线 overlay（CSS grid）；比例切换（1:1/4:3/16:9 → 约束 + 裁剪）；倒计时（3/5s）。捕获后回调 `onCapture(blob, type)`。
- `camera-controls.tsx`：底部控制条（模式 photo/video、切换、闪光、网格、比例、倒计时、开始/停止）。
- `shutter-animation.tsx`：Framer Motion 快门白闪 + 抓拍音（可选，无音频依赖）。
- `upload-progress.tsx`：XHR/fetch 进度条（`onUploadProgress` 等价，fetch 用 ReadableStream 计进度）。
- `watermark-settings.tsx`：水印项开关面板。
- `scene-result-card.tsx`：展示 AI 场景类型/标签/描述/推荐 Bucket/Goal + 「生成日志」按钮。

### Frontend — 页面（`apps/web/app/(app)/life/`）

- `camera/page.tsx`（新）：流程编排——选目标（下拉 active goals）→ `<AICamera onCapture>` → 预览 + 调 `analyzePhoto` 展示 `SceneResultCard` → 可选 `generateJournal` 填充正文 → 上传 `createLifeRecord`（含 GPS/海拔/天气/水印）→ 成功提示「✨ 记录完成，地图已更新 / 🔥 连续打卡 N 天 / +XP」→ 跳转记录详情或留页。`CountUp` 展示 XP/打卡。
- `checkin/page.tsx`（新）：🔥 连续打卡页——当前连续（CountUp）、最长连续、总打卡、今日是否完成、近 30 天热力图（纯 CSS 网格，按 `last_checkin_date` 与近期记录推算）、手动补签按钮。
- `video/page.tsx`（新）：视频日志画廊——`recordType=video` 列表，封面+时长+关联目标/Bucket，点击播放（`<video>`），Timeline 进入动画。
- `page.tsx`（改，life 首页）：顶部加「📷 AI 相机」入口按钮 + 「🔥 连续打卡 N 天」卡片（`getCheckinStreak`）。

### Integration（自动联动，无需新代码）

- **地图联动**：`LifeMapService` 已聚合 `LifeRecord`；视频记录带坐标即自动成为 Marker，时间轴自动刷新。
- **成长联动**：`LifeRecordService.create` 内 `award_xp` → `UserLevelRepository` 自动刷新等级；Achievement 检查沿用现有。
- **Year Review 联动**：`YearSummaryService._records` 已纳入；本 Sprint 扩展 `record_type` 后可区分照片/视频。

## Verification

**Backend（pytest，离线 MockAIProvider）— `apps/api/tests/`**
- `test_life_camera.py`：
  - 视频记录创建（`record_type=video` + video file + thumbnail + duration）→ dict 含 `videoUrl/thumbnailUrl/durationSeconds`。
  - 图片记录带 `scene_type/ai_tags/temperature` 入库。
  - 创建记录后 `GET /life/checkin` `checkedInToday=True`、`currentStreak==1`。
  - 连续两天（用例注入 `today`）→ +1；间隔一天 → 重置为 1；同日重复 → 幂等。
  - `longestStreak` 跟踪正确。
  - 创建记录后 `GET /life/dashboard` `experience` 增加（XP 生效）。
  - `POST /ai/photo-analysis`：MockAIProvider 非 JSON → fallback 字段非空。
  - `POST /ai/journal`：fallback `title/content` 非空。
  - 视频记录带坐标 → `GET /life/map` 出现 `sourceType==record` Marker。
  - 用户隔离：B 看不到 A 的 checkin/记录。
- 运行：`cd apps/api && pytest -q`

**Frontend**
- `cd apps/web && pnpm lint && pnpm typecheck && pnpm build`

## Deliverables & Done Criteria

- 新增页面：`/life/camera`、`/life/checkin`、`/life/video`
- 新增 API：`GET/POST /life/checkin`、`POST /ai/photo-analysis`、`POST /ai/journal`；扩展 `POST /life/goals/{id}/records`（视频字段）
- 新增 AI：photo-analysis（上下文驱动场景识别）、journal（日志生成），均带 fallback
- 新增连续打卡：`checkin_streaks` 表 + `CheckinStreakService` + 自动/手动触发
- 新增视频日志：`MediaRecorder` 30/60/180s + 封面 + 关联 Goal/Bucket
- 联动：地图 Marker / XP / Year Review 自动
- Validation：pytest ✅ ｜ lint ✅ ｜ typecheck ✅ ｜ build ✅
- Commit：`feat(life-camera): add AI camera and check-in module`
- 输出 `## Sprint 7 Completed`（新增页面/API/AI/连续打卡/视频日志/AI Journal + Validation + Routes + Commit Hash）后停止，等待 Sprint 8 Life Social。
