# Sprint 6 — Life Map（人生地图）

## Context
LifeOS 已有带经纬度的人生记录（`LifeRecord` 的 `latitude/longitude/city/country`，由创建记录时客户端上传，见 `apps/api/app/domains/life/router.py:83-86`）和带位置的人生目标（`LifeGoal` 的 `location/latitude/longitude`，适合旅行目的地）。但目前没有任何界面把这些地理位置可视化。本 Sprint 新增「人生地图」页：在世界地图上标注用户记录过的人生瞬间与目标目的地，让用户直观看到「我去过哪里、要在哪里完成什么」。

已与用户确认两个关键决策：
- **地图渲染**：使用 `leaflet` + `react-leaflet`（真实 OSM 瓦片、可平移缩放），新增该 npm 依赖。
- **后端**：允许新增 `GET /life/map` 聚合接口（镜像现有 `/life/dashboard` 模式），仅新增 repository/service/router 方法与测试，不改表结构、不改 AI。

## 后端（apps/api）— 新增 `GET /life/map`
复用现有分层模式（`/life/dashboard` 即 `router → service → repository`，返回 `{"data": ...}`）。

**`app/domains/life/repository.py`**
- `LifeRecordRepository.list_geotagged(user_id, limit=200)`：`filter(LifeRecord.user_id == user_id, LifeRecord.latitude != None, LifeRecord.longitude != None)`，`order_by(created_at.desc())`，`.limit(limit)`。
- `LifeGoalRepository.list_geotagged(user_id)`：`filter(user_id, latitude != None, longitude != None)`。

**`app/domains/life/service.py`** — 新增 `LifeMapService(db).get(user_id)`，返回：
```python
{
  "summary": {"totalRecords", "totalCities", "totalCountries", "totalDestinations"},
  "cities": [{"city","country","latitude","longitude","recordCount","latestRecordId","latestContent"}],  # 按 (country,city) 聚合，records 按 created_at desc 故首个即最新；按 recordCount 降序
  "records": [life_record_dict(r) ...],   # 复用现有 life_record_dict(service.py:61)，已含 lat/lng/city/country/photoUrl
  "destinations": [life_goal_dict(g) ...] # 复用现有 life_goal_dict(service.py:40)，已含 location/latitude/longitude/title/status/category
}
```

**`app/domains/life/router.py`** — 新增 `GET /life/map`：
```python
@router.get("/life/map")
def life_map(current_user, db): return {"data": LifeMapService(db).get(current_user.id)}
```

**`tests/test_life_map.py`** — 覆盖：带/不带坐标记录的过滤、城市聚合 recordCount、目标目的地筛选、汇总统计、用户隔离（他人记录不出现）。复用 `tests/test_life_records.py` 的建数据模式。

验证：`uv run pytest tests/test_life_map.py` + 全量 `pytest` + `ruff check`。

## 前端（apps/web）— 新增 `/life/map` 页

**依赖**：`npm i leaflet react-leaflet` + `npm i -D @types/leaflet`。预期 react-leaflet v5（适配 React 19）；若 v5 不可用则回退为 vanilla `leaflet`（useRef+useEffect，单依赖，规避 React 版本耦合）。

**`lib/life.ts`** — 新增类型与取数函数（沿用 `apiFetch`，禁止直接 fetch）：
- `LifeMapSummary`、`LifeMapCity`、`LifeMapDestination`、`LifeMapData` 接口
- `getLifeMap(): Promise<LifeMapData>` → `apiFetch<LifeMapData>("/life/map")`

**地图组件**（`components/life/map/`）
- `life-map-view.tsx`（"use client"，**纯客户端**）：`react-leaflet` 的 `<MapContainer>` + OSM `<TileLayer>`（`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`，带 attribution）。记录用自定义 `L.divIcon`（SVG 图钉，主色）+ `<Popup>`（内容/城市/日期）；目标目的地用旗帜样式 divIcon（琥珀色）。**用 divIcon 而非默认 Marker，规避 leaflet 默认图标图片在打包器下 404 的已知问题**，也便于主题化。`import "leaflet/dist/leaflet.css"`。
- `life-map-client.tsx`：`next/dynamic(() => import("./life-map-view"), { ssr: false, loading: () => <Skeleton/> })` —— leaflet 依赖 `window`，必须关 SSR；加载时显示骨架。

**页面**（`app/(app)/life/map/page.tsx`）— 沿用 `/life` 的 `useQuery` 模式（参考 `app/(app)/life/page.tsx:20-23`）：
- 顶部摘要卡（记录数 / 城市数 / 国家数 / 目的地数）。
- 地图主体（`LifeMapClient`，高度 ~480px，响应式）。
- 右侧/下方城市列表（来自 `cities`，显示 recordCount，点击飞到该坐标并打开 popup）。
- 空态：无坐标记录时引导「在创建记录时带上位置」。
- 容器宽度沿用 `max-w-5xl`（与 `/life` 一致）。

**入口卡**（`app/(app)/life/page.tsx`，现有 entry grid 在 67-82 行）— 新增第三张 Link 卡「我的人生地图」→ `/life/map`（lucide `Map` 图标），与现有「我的人生记录/我的年度报告」卡片同风格。

## 关键复用点
- `life_record_dict`（`service.py:61`）、`life_goal_dict`（`service.py:40`）直接复用，字段已含坐标。
- `BaseRepository`（`app/core/repository.py`）、`get_current_user`/`get_db` 依赖注入模式。
- 前端 `apiFetch`（`lib/api.ts`）、`useQuery` 模式、`components/ui.tsx` 的 Card/Badge/Skeleton/Button。

## Verification
1. 后端：`cd apps/api && uv run pytest tests/test_life_map.py -v` → 全量 `uv run pytest -q` → `uv run ruff check app tests`。
2. 前端：`cd apps/web && npm run typecheck && npm run lint && npm run build` → 确认路由数由 28 增至 29（新增 `/life/map`），无报错。
3. 手动（可选）：`npm run dev`，访问 `/life` 看到「我的人生地图」入口卡，进入 `/life/map` 地图渲染、图钉 popup 正常、城市列表点击可飞到坐标。
4. 提交：`feat(life-map): add Life Map with geotagged records and goal destinations`（后端与前端各一或合并提交）。
