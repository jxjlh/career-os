# Career OS API 设计（Step 4）

状态：待确认

日期：2026-07-31

范围：免费版 / 中文优先 / 讯飞星火 Spark-X2-Flash / 语音面试（浏览器转写）/ Supabase PostgreSQL

本阶段在 Step 3 表结构基础上，定义全部 REST 接口、请求响应契约、异步任务、SSE 流式、限流、错误码与前后端共享 schema。Step 6 将据此实现 FastAPI Router、Pydantic Schema 与前端 API Client。

---

## 1. 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | `/api/v1` |
| 数据格式 | JSON，UTF-8 |
| 认证 | `Authorization: Bearer <supabase_jwt>` |
| 成功响应 | `{ "data": ... }` |
| 列表响应 | `{ "data": [...], "meta": { "page", "limit", "total", "hasMore" } }` |
| 错误响应 | `{ "error": { "code", "message", "details" } }` |
| 创建 | 201 Created，返回完整对象 |
| 异步任务 | 202 Accepted，返回 jobId 与 pollUrl |
| 幂等 | AI 生成类接口支持 `Idempotency-Key` 请求头 |
| 追踪 | 服务端生成 `X-Request-Id`，日志与错误响应携带 |
| 版本 | `/api/v1`，破坏性变更升级 v2 |

### 1.1 分页

- 普通列表：`?page=1&limit=20`，limit 默认 20，上限 100。
- 事件流 / 消息：cursor 分页，`?cursor=<opaque>&limit=50`，响应 meta 含 `nextCursor`。
- 排序：`?sort=created_at&order=desc`，默认按创建时间倒序。

### 1.2 过滤

统一使用查询参数，如 `?status=active`、`?type=video&language=zh`、`?tag=sql`、`?from=2026-07-01&to=2026-07-31`。

### 1.3 异步任务

```json
{
  "data": {
    "jobId": "019fb5ef-...",
    "status": "queued",
    "pollUrl": "/api/v1/explore/jobs/019fb5ef-..."
  }
}
```

任务状态：queued / running / succeeded / failed。客户端轮询 `pollUrl`，或在前端任务中心统一轮询。

### 1.4 SSE 流式

AI 对话与资源生成返回 `text/event-stream`：

```text
event: message
data: {"content":"正在分析你的技能差距..."}

event: tool_call
data: {"tool":"recommend_resources","status":"running"}

event: message
data: {"content":"建议先完成 SQL 基础..."}

event: done
data: {"messageId":"019fb5f0-..."}
```

事件类型：message / tool_call / done / error / quota。前端收到 done 后关闭连接。

### 1.5 幂等

- `Idempotency-Key` 对同一用户 + Key 在 24 小时内返回首次结果，不重复生成。
- 幂等只用于 POST 生成类接口：搜索、AI 总结、生成路线、JD 分析、简历生成、周计划生成。

### 1.6 限流

| 接口类别 | 限流 |
| --- | --- |
| 普通接口 | 60 req/min/用户 |
| AI 生成 | 5 req/min/用户 |
| 搜索 | 10 req/min/用户 |
| SSE | 并发 2 条连接/用户 |

免费额度（每日）由 `user_limits` 控制：AI 对话 30 条、搜索 20 次、总结 20 次、Quiz 10 次、面试 3 场、简历 3 次。

### 1.7 错误码

| HTTP | code | 说明 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 参数校验失败 |
| 401 | UNAUTHORIZED | 未登录或 Token 失效 |
| 403 | FORBIDDEN | 无权访问 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 唯一约束冲突 |
| 422 | AI_OUTPUT_INVALID | AI 输出未通过 schema 校验 |
| 429 | RATE_LIMITED | 请求频率超限 |
| 429 | QUOTA_EXCEEDED | 免费额度用完 |
| 500 | INTERNAL_ERROR | 服务端错误 |
| 502 | PROVIDER_ERROR | AI / 搜索 Provider 失败 |
| 504 | TIMEOUT | 上游超时 |

---

## 2. Auth 与 Onboarding

| Method | Path | 说明 |
| --- | --- | --- |
| POST | /auth/callback | Supabase 回调后同步 profiles |
| GET | /me | 当前用户信息 |
| PATCH | /me | 更新用户信息 |
| GET | /onboarding/status | 引导状态 |
| POST | /onboarding | 提交引导并触发初始生成 |
| GET | /me/limits | 今日额度使用情况 |

### POST /onboarding

```json
{
  "currentTitle": "市场营销专员",
  "targetTitle": "Growth Marketing Manager",
  "targetSalary": 400000,
  "experienceYears": 3,
  "weeklyStudyMinutes": 420,
  "skills": [
    { "skillId": "uuid", "currentLevel": 3, "targetLevel": 7 }
  ],
  "timezone": "Asia/Shanghai"
}
```

响应：202，后台任务生成初始 roadmaps 与 weekly_plans。

---

## 3. Dashboard

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /dashboard/summary | 统计汇总 |
| GET | /dashboard/trends?range=7d | 成长趋势 |
| GET | /dashboard/calendar?month=2026-07 | 学习日历 |
| GET | /dashboard/ai-advice | AI 建议 |
| GET | /dashboard/recent | 近期学习 / 项目 / 任务 |

### GET /dashboard/summary

```json
{
  "data": {
    "weeklyMinutes": 210,
    "streakDays": 5,
    "skillsCompleted": 8,
    "projectCount": 3,
    "okrProgress": 62.5,
    "todayTasks": 4,
    "todayTasksDone": 1
  }
}
```

### GET /dashboard/trends

```json
{
  "data": {
    "range": "30d",
    "points": [
      { "date": "2026-07-01", "minutes": 45, "resourcesCompleted": 1 }
    ]
  }
}
```

### GET /dashboard/calendar

```json
{
  "data": {
    "month": "2026-07",
    "days": [
      { "date": "2026-07-31", "minutes": 30, "resourcesCompleted": 1 }
    ]
  }
}
```

### GET /dashboard/ai-advice

```json
{
  "data": {
    "advice": "你最近 7 天 SQL 练习完成度高，建议本周开始 Power BI 可视化项目。",
    "reason": "Power BI 与目标岗位匹配，且差距最大。",
    "actions": ["生成周计划", "搜索学习资源"]
  }
}
```

---

## 4. Roadmap

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /roadmaps | 路线列表 |
| POST | /roadmaps | 创建空路线 |
| GET | /roadmaps/{id} | 路线详情含里程碑 |
| PATCH | /roadmaps/{id} | 修改标题 / 状态 |
| DELETE | /roadmaps/{id} | 软删除 |
| POST | /roadmaps/{id}/generate | AI 生成 3/5/10 年路线 |
| POST | /roadmaps/{id}/milestones | 新增里程碑 |
| PATCH | /roadmaps/{id}/milestones/{mid} | 修改里程碑 |
| DELETE | /roadmaps/{id}/milestones/{mid} | 删除里程碑 |
| PUT | /roadmaps/{id}/milestones/order | 拖拽排序 |

### POST /roadmaps/{id}/generate

```json
{
  "horizonYears": 5,
  "targetTitle": "Growth Marketing Manager",
  "focusSkills": ["SQL", "Power BI", "Growth Marketing"],
  "weeklyStudyMinutes": 420
}
```

响应：202。完成后路线包含里程碑列表。

### PUT /roadmaps/{id}/milestones/order

```json
{
  "milestoneIds": ["uuid1", "uuid2", "uuid3"]
}
```

---

## 5. Skill Matrix

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /skills | 技能目录 |
| GET | /skills/matrix | 用户技能矩阵 |
| PUT | /skills/{skillId}/progress | 更新等级 |
| POST | /skills/{skillId}/recommendations | AI 推荐资源与项目 |
| POST | /skills/{skillId}/path | AI 生成技能成长路径 |

### PUT /skills/{skillId}/progress

```json
{
  "currentLevel": 4,
  "targetLevel": 7,
  "confidence": 55,
  "notes": "掌握基础语法，缺少实战"
}
```

### GET /skills/matrix

```json
{
  "data": {
    "radar": {
      "skills": [
        { "name": "SQL", "current": 4, "target": 7 }
      ]
    },
    "items": [
      {
        "skillId": "uuid",
        "name": "Power BI",
        "category": "Data",
        "currentLevel": 3,
        "targetLevel": 6,
        "gap": 3
      }
    ]
  }
}
```

---

## 6. Learning Explorer

| Method | Path | 说明 |
| --- | --- | --- |
| POST | /explore/search | 发起实时搜索（异步） |
| GET | /explore/jobs/{jobId} | 查询任务与结果 |
| GET | /explore/history | 搜索历史 |
| GET | /explore/providers | 可用 Provider |
| GET | /explore/resources/{id} | 资源详情 |
| POST | /explore/resources/{id}/summary | AI 总结 |
| POST | /explore/resources/{id}/key-points | 重点提炼 |
| POST | /explore/resources/{id}/mindmap | 思维导图 |
| POST | /explore/resources/{id}/quiz | 生成 Quiz |
| POST | /explore/resources/{id}/cards | 知识卡 |
| POST | /explore/resources/{id}/ask | 基于资源提问 |
| POST | /explore/resources/{id}/state | 更新学习状态 |
| POST | /explore/resources/{id}/bookmark | 收藏 / 取消 |

### POST /explore/search

```json
{
  "query": "Power BI 从入门到进阶",
  "providers": ["tavily", "youtube", "wikipedia"],
  "filters": {
    "types": ["course", "video", "article"],
    "language": "zh",
    "difficulty": "beginner",
    "freeOnly": true,
    "officialFirst": true,
    "publishedAfter": "2024-01-01"
  },
  "limit": 20
}
```

响应：202 + jobId。任务完成后结果结构：

```json
{
  "data": {
    "queryId": "uuid",
    "items": [
      {
        "resourceId": "uuid",
        "title": "Power BI 官方文档",
        "description": "微软官方入门指南",
        "provider": "google",
        "source": "learn.microsoft.com",
        "type": "document",
        "language": "zh",
        "difficulty": "beginner",
        "durationMinutes": 120,
        "isOfficial": true,
        "isFree": true,
        "url": "https://...",
        "thumbnailUrl": "https://...",
        "score": 0.92,
        "myState": "saved"
      }
    ]
  }
}
```

### POST /explore/resources/{id}/summary

请求头携带 `Idempotency-Key`。响应：202；完成后 SSE 或轮询获取总结文本。

### POST /explore/resources/{id}/quiz

```json
{
  "questionCount": 5,
  "difficulty": "intermediate"
}
```

结果：

```json
{
  "data": {
    "questions": [
      {
        "question": "DAX 中 CALCULATE 的作用是什么？",
        "options": ["A", "B", "C", "D"],
        "answerIndex": 1,
        "explanation": "CALCULATE 用于修改筛选上下文。"
      }
    ]
  }
}
```

### POST /explore/resources/{id}/ask

```json
{
  "question": "如何用 Power BI 做漏斗分析？"
}
```

响应：SSE 流式回答。

---

## 7. Projects

| Method | Path | 说明 |
| --- | --- | --- |
| GET/POST | /projects | 列表 / 创建 |
| GET/PATCH/DELETE | /projects/{id} | 详情 / 修改 / 软删除 |
| POST | /projects/{id}/files | multipart 上传 |
| GET | /projects/{id}/files/{fileId}/url | 签名 URL |
| POST | /projects/{id}/analyze | AI 分析 |
| GET | /projects/{id}/analyses | 分析历史 |

### POST /projects

```json
{
  "title": "电商用户增长分析",
  "description": "分析渠道 ROI 与留存",
  "role": "数据分析师",
  "repoUrl": "https://github.com/user/project",
  "tags": ["Growth", "SQL"]
}
```

### POST /projects/{id}/analyze

```json
{
  "analysisTypes": ["star", "intro", "resume"]
}
```

响应：202。完成后 project_analyses 包含三份结构化结果。

---

## 8. Interview Center

| Method | Path | 说明 |
| --- | --- | --- |
| GET/POST | /interviews | 列表 / 创建 |
| GET/PATCH/DELETE | /interviews/{id} | 详情 / 修改 / 删除 |
| POST | /interviews/{id}/questions | 生成题目 |
| POST | /interviews/{id}/sessions | 开始会话 |
| POST | /sessions/{id}/answer | 提交文本回答 |
| POST | /sessions/{id}/answers/voice | 提交语音与转写 |
| GET | /sessions/{id}/transcript | 会话转写 |
| POST | /sessions/{id}/finish | 结束并评分 |
| GET | /sessions/{id}/feedback | 评分结果 |

### POST /interviews

```json
{
  "title": "Growth 岗位模拟面试",
  "interviewType": "mock",
  "mode": "behavioral",
  "role": "Growth Marketing Manager",
  "difficulty": "intermediate",
  "config": {
    "questionCount": 6,
    "timePerQuestionSeconds": 180
  }
}
```

### POST /sessions/{id}/answers/voice

```json
{
  "questionId": "uuid",
  "answerText": "用户校对后的转写文本",
  "audioPath": "interviews/user_id/session_id/q1.webm",
  "durationSeconds": 95
}
```

### POST /sessions/{id}/finish

响应：202。完成后调用 GET /sessions/{id}/feedback。

```json
{
  "data": {
    "overallScore": 81,
    "dimensions": {
      "structure": { "score": 82, "comment": "使用了总分总结构" },
      "star": { "score": 76, "comment": "结果量化不足" },
      "expression": { "score": 88, "comment": "表达流畅" },
      "technical_depth": { "score": 70, "comment": "缺少原理说明" },
      "time_control": { "score": 85, "comment": "时间控制良好" }
    },
    "strengths": "结构化表达清晰",
    "improvements": "补充数据结果与复盘",
    "sampleAnswer": "参考回答..."
  }
}
```

---

## 9. Job Market

| Method | Path | 说明 |
| --- | --- | --- |
| GET/POST | /jobs | 列表 / 保存 |
| GET/PATCH/DELETE | /jobs/{id} | 详情 / 更新 / 删除 |
| POST | /jobs/{id}/analyze | JD 解析（保留历史） |
| GET | /jobs/{id}/analyses | 分析历史 |
| GET | /jobs/{id}/gap | 技能差距 |
| POST | /jobs/{id}/learning-plan | 生成学习路线与周计划 |

### POST /jobs

```json
{
  "title": "Growth Marketing Manager",
  "company": "某互联网公司",
  "location": "上海",
  "url": "https://...",
  "jdRaw": "岗位职责：...",
  "salaryMin": 300000,
  "salaryMax": 450000,
  "currency": "CNY"
}
```

### GET /jobs/{id}/gap

```json
{
  "data": {
    "matchScore": 62,
    "gaps": [
      {
        "name": "Power BI",
        "currentLevel": 3,
        "requiredLevel": 6,
        "gap": 3,
        "status": "improving"
      },
      {
        "name": "Marketing Ops",
        "currentLevel": null,
        "requiredLevel": 5,
        "gap": 5,
        "status": "missing"
      }
    ]
  }
}
```

### POST /jobs/{id}/learning-plan

```json
{
  "weeks": 8,
  "weeklyStudyMinutes": 420
}
```

响应：202，创建 roadmap 与 weekly_plans。

---

## 10. Salary Planner

| Method | Path | 说明 |
| --- | --- | --- |
| POST | /salary-plans/generate | AI 拆解 |
| GET | /salary-plans/{id} | 详情 |
| PATCH | /salary-plans/{id} | 调整假设重算 |

### POST /salary-plans/generate

```json
{
  "currentSalary": 200000,
  "targetSalary": 500000,
  "currency": "CNY",
  "horizonYears": 3,
  "assumptions": {
    "weeklyStudyHours": 7,
    "city": "上海",
    "willingToSwitchCompany": true
  }
}
```

响应：202。完成后 breakdown 包含阶段、技能、项目、岗位阶梯与时间线。

---

## 11. AI Career Coach

| Method | Path | 说明 |
| --- | --- | --- |
| GET/POST | /coach/chats | 会话列表 / 新建 |
| GET/DELETE | /coach/chats/{id} | 详情 / 删除 |
| GET | /coach/chats/{id}/messages | 历史消息（cursor） |
| POST | /coach/chats/{id}/messages | 发送消息（SSE） |
| GET | /coach/context | 上下文摘要 |

### POST /coach/chats

```json
{
  "channel": "coach",
  "title": "如何准备跳槽",
  "context": {
    "dataSources": ["skills", "learning_history", "projects", "jobs", "interviews"]
  }
}
```

### POST /coach/chats/{id}/messages

```json
{
  "content": "我想三个月后跳到 Growth 方向，下一步学什么？"
}
```

响应：SSE。完成后消息落库 ai_messages，含 provider / model / tokens。

---

## 12. Resource Library

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /library/bookmarks | 收藏列表 |
| PATCH/DELETE | /library/bookmarks/{id} | 更新 / 删除 |
| GET/POST | /library/tags | 标签列表 / 创建 |
| POST | /library/bookmarks/{id}/tags | 添加标签 |
| DELETE | /library/bookmarks/{id}/tags/{tagId} | 移除标签 |

### GET /library/bookmarks

```json
{
  "data": [
    {
      "bookmarkId": "uuid",
      "resourceId": "uuid",
      "title": "Power BI 官方文档",
      "note": "第 2 章已看完",
      "tags": ["数据分析", "官方"],
      "state": "in_progress",
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

---

## 13. Resume Builder

| Method | Path | 说明 |
| --- | --- | --- |
| GET/POST | /resumes | 列表 / 创建 |
| GET/PATCH/DELETE | /resumes/{id} | 详情 / 编辑 / 删除 |
| POST | /resumes/{id}/generate | AI 生成 |
| POST | /resumes/{id}/versions | 生成版本 |
| GET | /resumes/{id}/versions/{version} | 回看版本 |
| POST | /resumes/{id}/export | 创建异步导出任务（202） |

### POST /resumes/{id}/generate

```json
{
  "language": "zh",
  "targetTitle": "Growth Marketing Manager",
  "template": "clean",
  "includeSections": ["summary", "skills", "projects", "experience", "education"]
}
```

响应：202。完成后 resumes.sections 包含生成内容，version 自增并写入 resume_versions。

### POST /resumes/{id}/export

```json
{
  "format": "pdf"
}
```

响应：202 + jobId。任务完成后通过下载中心获取签名 URL。

### 下载中心

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /downloads | 当前用户导出任务列表 |
| GET | /downloads/{jobId} | 获取文件下载签名 URL |

下载中心复用 background_jobs：job_type 为 export，任务成功后 result 写入 storage_path，下载接口返回签名 URL。简历 PDF 与 Analytics CSV 均走该中心。

---

## 14. Weekly Planner

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /planner/current | 当前周计划 |
| POST | /planner/generate?week=2026-07-27 | AI 生成 |
| PATCH | /planner/tasks/{id} | 修改任务 |
| POST | /planner/tasks/{id}/complete | 完成任务 |
| PUT | /planner/tasks/order | 拖拽排序 |

### POST /planner/generate

```json
{
  "weekStart": "2026-07-27",
  "weeklyStudyMinutes": 420,
  "prioritySkills": ["Power BI", "SQL"]
}
```

响应：202。完成后返回 7 天任务列表，每个任务含 title / day / estimatedMinutes / resourceId / status。

---

## 15. Analytics

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /analytics/overview | 综合看板 |
| GET | /analytics/time?range=30d | 学习时间 |
| GET | /analytics/skills | 技能增长 |
| GET | /analytics/completion | 完成率 |
| GET | /analytics/okr | OKR 进度 |
| POST | /analytics/export | 创建异步导出任务（202） |

### GET /analytics/overview

```json
{
  "data": {
    "totalMinutes": 1240,
    "avgMinutesPerDay": 41,
    "resourcesCompleted": 12,
    "completionRate": 68.4,
    "skillGrowth": 1.8,
    "projectCount": 3
  }
}
```

### POST /analytics/export

请求：`{ "range": "90d" }`。响应：202 + jobId，任务完成后通过下载中心获取 CSV。

---

## 16. Admin / System

| Method | Path | 说明 |
| --- | --- | --- |
| GET | /admin/providers | Provider 状态 |
| PATCH | /admin/providers/{id} | 启用 / 禁用 / 配置 |
| POST | /admin/providers/{id}/test | 连通性测试 |
| GET | /health | 存活检查 |
| GET | /ready | 依赖就绪检查 |
| GET | /metrics | Prometheus 指标 |

### GET /health

```json
{
  "status": "ok"
}
```

### GET /ready

```json
{
  "status": "ready",
  "checks": {
    "postgres": "ok",
    "storage": "ok",
    "ai_provider": "ok"
  }
}
```

---

## 17. 请求响应契约管理

1. 后端：FastAPI Pydantic v2，模型名与数据库表对应，如 `ProjectCreate`、`SearchResultItem`。
2. OpenAPI 为唯一契约源：FastAPI 自动生成 `/openapi.json`，前端使用 openapi-typescript 生成类型。
3. 前端请求层：由生成类型 + 统一 fetch 客户端组合，不手工维护重复类型。
4. 变更流程：新增字段必须带默认值；删除字段先弃用一期；破坏性变更升级 `/api/v2`。
5. 契约测试：Step 7 使用 pytest 对每个 Router 校验 request / response schema，并验证 OpenAPI 生成结果。

---

## 18. 已确认决策（Step 4 评审结论）

1. 首版同时支持网页端与移动端：Web 响应式 + PWA，可安装到主屏幕；原生 App 作为后续版本。
2. 前端类型直接由 OpenAPI 生成（openapi-typescript），不再手工维护 packages/shared 类型。
3. 简历 PDF 与 Analytics CSV 均走异步下载中心：创建导出任务 -> 轮询任务 -> 获取签名下载 URL。
4. 界面支持中英文双语（zh-CN / en），语言偏好写入 profiles.language，默认跟随浏览器设置。

以上决策已回写本设计，进入 Step 5 UI 设计。
