# Sprint 5.5 — AI Bucket List（人生必做清单）

## Context

AI LifeOS 目前只有「人生目标 / 记录 / 年度报告 / 地图」,缺少一个**入口型**模块把整条生命周期串起来。Sprint 5.5 新增 **Bucket List（人生必做清单）**:模板 → AI 推荐 → 加入人生目标 → LifeGoal → AI Travel/Growth → LifeRecord → Achievement → LifeMap → YearReview,数据全程互通。

> ⚠️ 对齐说明:用户原始 spec 结尾写「等待 Sprint 6:Life Map」,但 **Life Map 已在上一轮完成并提交**(`40cf9b8`,`GET /life/map` 与 `/life/map` 页面已存在)。本 Sprint 直接复用 Life Map,不重建。

## 已确认的关键约定(来自代码探查)

| 约定 | 结论 |
|---|---|
| 表创建 | **Alembic 存在**(`apps/api/migrations/`,head=`9e1c2a3b4c5d`)。dev/test 走 `create_all`(main.py lifespan),prod 走 `alembic upgrade head`。**新表必须配 migration**,否则 prod 500。 |
| 模型风格 | `app/db/models.py`,`Base`+`uuid_str()`+`Mapped`/`mapped_column`+`DateTime(timezone=True) default=datetime.utcnow`+`JSON`+`ForeignKey(ondelete="CASCADE")`。 |
| AI 集成 | `AIService.generate_content(user_id, content_type, input_data, prompt)->(AIContent, parsed)`(`app/domains/ai/service.py:35`),`extract_json` 容错(`app/providers/ai/base.py`),prompts 在 `app/domains/ai/prompts/`,schemas 在 `app/domains/ai/schemas.py`,router 在 `app/domains/ai/router.py`。 |
| AI 失败回退 | 项目硬约束:解析失败回退硬编码值。`AIService` 在 provider 失败/非 JSON 时抛 `AppError`;由调用方 catch 后回退。 |
| 响应封装 | **life 域**:`{"data": ...}`;**ai 域**:直接返回 Pydantic `response_model`。bucket CRUD 走 `{data}`,AI 推荐走直接模型。 |
| LifeGoal | `category String(40)`;`LifeCategory=travel|career|skill|health|relationship|finance|other`;`LifeGoalService.update` 在置为 completed 时自动 `award_xp`(`life/service.py:137`)。 |
| 已有 AI 流 | `TravelPlanService`/`GrowthPlanService`/`GrowthTaskGeneratorService` 已存在并产出 LifeGoal 关联任务。join **不重复跑 AI**;详情页深链到现有 `/life/goals/[id]/ai`。 |
| 前端 | `apiFetch<{data:T}>().data` 封装;页面 "use client"+react-query;UI 原语在 `components/ui.tsx`;`CountUp` 在 `components/life/review/count-up.tsx`;CSS columns 瀑布流模板 `components/life/review/year-review-memory-wall.tsx`;`LifeMapClient` 可复用单点地图。 |
| 图片 | 强制使用 `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={enc}&image_size={size}`,禁止占位图。每个 `<img>` 后垫渐变兜底,URL 失败时降级。 |

## 数据模型(3 表,加到 `app/db/models.py`)

- **BucketCategory**:`id, name, icon, color, cover_image, sort, created_at`
- **BucketItem**:`id, category_id(FK), title, subtitle, description, story, cover_image, gallery_images(JSON), video_url, difficulty(SmallInt), estimated_cost(String), estimated_days(Int), best_season(String), country, city, location, latitude, longitude, address, tags(JSON), tips(Text), ai_prompt(Text), popularity(Int), completed_count(Int), status(String default "published"), created_at, updated_at`。索引 `category_id`/`status`。
- **UserBucketItem**:`id, user_id(FK), bucket_item_id(FK), life_goal_id(FK nullable), status(String default "none"), wishlist(Bool), favorite(Bool), completed(Bool), joined_at, completed_at, created_at`。`UniqueConstraint("user_id","bucket_item_id")` 防重复加入。

## Alembic migration

新建 `migrations/versions/<rev>_add_bucket_tables.py`,`down_revision="9e1c2a3b4c5d"`,镜像 `3a750f86e9c3_add_life_records.py` 风格:`op.create_table`×3 + 索引 + FK + `upgrade`/`downgrade`。

## Seed(放 lifespan,幂等)

`app/domains/bucket/seed.py` 的 `seed_bucket_data(db)`:仅在 `bucket_categories` 为空时插入 **12 分类**(旅行/成长/学习/摄影/挑战/爱情/家庭/事业/财富/公益/运动/体验)+ **~18 items**(去西藏/看极光/去南极/跳伞/热气球/学潜水/马拉松/环球旅行 等,含 country/city/lat/lng/tags/best_season/estimated_cost/days/popularity)。`cover_image` 存 `trae-api` text_to_image URL(prompt 按条目定制,`image_size=landscape_4_3`)。在 `main.py` lifespan 的 `create_all` 之后**无条件**调用(prod 在 `alembic upgrade head` 后启动时也会跑,幂等安全)。

## 后端域 `app/domains/bucket/`(Feature First)

- `schemas.py`:`ConfigDict(populate_by_name=True, alias_generator=to_camel)`。`BucketCategoryOut`(含 itemCount)、`BucketItemOut`(含可选 `userState`)、`BucketItemListResponse`(total/page/pageSize/items)、`BucketProgressResponse`、`JoinResponse`。
- `repository.py`:`BucketCategoryRepository`、`BucketItemRepository.search(...)`(动态过滤:`q` ilike title/location/tag/country/city;`category`/`country`/`city`/`tag`/`difficulty`/`season`;`completed` 经 user_bucket_items join;排序 popular/latest/recommended/nearest[需 lat/lng])、`UserBucketItemRepository`。search 用 outerjoin 带出当前用户 `userState`。
- `service.py:BucketService`:`list_categories`、`list_items`、`get_item`、`join`(单事务:构造 `LifeGoal`+`UserBucketItem`,`db.add` 两者后**一次 commit**;已存在→409)、`unjoin`(删 UserBucketItem,保留 LifeGoal)、`toggle_favorite`、`toggle_wishlist`、`complete`(委托 `LifeGoalService.update(status=completed)` 触发 `award_xp`,再写 `user_bucket_items.completed_at`)、`progress`。**分类映射**:旅行→travel,成长/学习/摄影→skill,挑战/公益/体验→other,爱情/家庭→relationship,事业→career,财富→finance,运动→health。
- `router.py`(paths `/life/bucket/...`):`GET /categories`、`GET /items`、`GET /items/{id}`、`POST /items/{id}/join`、`DELETE /items/{id}/join`、`POST /items/{id}/favorite`、`POST /items/{id}/wishlist`、`POST /items/{id}/complete`、`GET /progress`。
- `main.py`:注册 `bucket_router`(prefix=`api_prefix`)。

## AI 推荐

- `app/domains/ai/prompts/bucket_recommendation.py`:`BUCKET_RECOMMENDATION_PROMPT`,要求 AI 仅返回 JSON `{recommendations:[{item_id, reason, match_score(0-100), priority}]}`,5~10 条,`item_id` 必须来自传入目录。
- `app/domains/ai/schemas.py`:加 `BucketRecommendationRequest`/`BucketRecommendationItem`/`BucketRecommendationResponse`(含 `source: "ai"|"fallback"`)。
- `BucketRecommendationService`(放 `ai/service.py`):构造短目录(全部 ~18 条;量大时按 city/budget/category 预筛 top 40)→ `AIService.generate_content` → 校验 `item_id` 存在、丢弃未知 → catch `AppError` 回退 `popularity` top 8(带 `source="fallback"`、canned reason)。
- `ai/router.py`:`POST /ai/bucket-recommendation`,直接返回 `response_model`(无封装)。

## 前端

- `lib/bucket.ts`:类型 + fetcher。CRUD 用 `apiFetch<{data:T}>().data`;`recommendBucket` 用直接 `apiFetch<T>()`。含 `getBucketItems(params)`(URLSearchParams)、`joinBucket`/`unjoinBucket`/`toggleFavorite`/`toggleWishlist`/`completeBucket`/`getBucketProgress`/`getBucketCategories`/`getBucketItem`。
- `components/life/bucket/`(仅抽可复用件):
  - `bucket-hero.tsx`:`CountUp` 完成/500(aspirational 常量)+ XP/level/streak(streak 由后端从 LifeRecord 连续天数算),framer fade。
  - `bucket-search-bar.tsx`:搜索 + 筛选 + 排序下拉。
  - `bucket-category-bar.tsx`:分类(带 itemCount badge)。
  - `bucket-card.tsx`:cover(`trae-api` URL + 渐变兜底)+ title + difficulty + 已加入 badge + hover scale。
  - `bucket-grid.tsx`:CSS columns 瀑布流(`columns-1 sm:columns-2 lg:columns-3 xl:columns-4`,`break-inside-avoid`)。
  - `bucket-ai-recommendation.tsx`:推荐卡(reason + match badge + `source` 提示)。
  - `bucket-join-button.tsx`:mutation + 成功提示(检测现有 toast lib;无则内联成功条 + 「立即查看」链到 `/life/goals/[id]`),已加入 disabled。
- `app/(app)/life/bucket/page.tsx`:hero(`useQuery getBucketProgress`)+ AI 推荐区(`useQuery recommendBucket`)+ 搜索/筛选/排序(`useState`)+ 分类栏 + 瀑布流(`useInfiniteQuery`,key 随筛选态变)。骨架/错误重试/空态。
- `app/(app)/life/bucket/[id]/page.tsx`:详情 hero(cover/gallery/title/subtitle/desc/story/why/best season/budget/days/country/city/location)+ mini map(`<LifeMapClient records={[]} destinations={[{id,title,latitude,longitude,location,targetDate}]} />`)+ join 按钮 + AI planner 深链(travel→Travel Planner,else Growth Planner,带 goalId)+ Life Records(已加入后用 `getGoalRecords(lifeGoalId)` 复用)。
- `/life` 首页:加「人生必做清单」入口卡片(镜像现有 records/map/review 卡片行)。

## 测试

- `tests/test_bucket.py`:分类列表(含 count)、列表 search/filter/sort(含 nearest lat/lng)、详情、join 创建 LifeGoal+link 单事务、重复 join 409、unjoin、`X-Dev-User-Id` 用户隔离、toggle favorite/wishlist、complete 触发 XP 且 LifeGoal 置 completed、progress(streak)。**测试隔离**:count 敏感用例创建带 `uuid` 唯一标题的 item 并按标题过滤;catalog 用例断言已知 seed 条目。
- `tests/test_bucket_recommendation.py`:成功路径(注入返回合法 JSON 的 fake provider,`AIService.generate_content` 支持 `provider=`)+ 回退路径(`MockAIProvider` 返回非 JSON → 走 popularity fallback,`source="fallback"`)。

## 验证

1. 后端:`cd apps/api && APP_ENV=test uv run pytest tests/test_bucket.py tests/test_bucket_recommendation.py -q`(随后跑全量确认无回归);`uv run ruff check app/domains/bucket app/domains/ai app/db/models.py`。
2. migration 健康性:`APP_ENV=dev uv run alembic upgrade head` 应用干净 + `alembic downgrade -1` 可回滚。
3. 前端:`npm --workspace apps/web run lint && run typecheck && run build`,确认新增 `/life/bucket` 与 `/life/bucket/[id]` 两条路由(总 31 app routes)。
4. 提交:`feat(bucket): add AI bucket list module`。

## 范围裁剪(避免过度工程)

- 评论/点赞/收藏**仅预留**(无表、无端点),`favorite`/`wishlist` 是 `user_bucket_items` 上的布尔列。
- 详情 hero 内联到页面,不单独抽组件。
- 不新建 leaflet 组件,详情 mini map 复用 `LifeMapClient`。
- AI 推荐不做 match score 可视化/re-ranking UI,只展示 reason + match badge。
- join 不同步跑 AI;详情页深链到现有 AI planner。
