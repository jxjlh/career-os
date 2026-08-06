# 英语学习模块 + 关闭注册邮箱验证

## Context

用户提出两个需求：
1. **关闭注册邮箱验证**：当前注册后需要邮箱确认才能登录，用户希望注册后直接登录
2. **新增英语学习模块**：从英语四级往上，包含单词读写、听力功能，参考市面英语学习软件（百词斩/墨墨/扇贝等）

用户确认的设计选择：内置种子词库（每级 200-300 核心词）、讯飞 TTS API 做音频、四项功能全做（单词卡片 + SRS 复习 + 听力练习 + 学习统计）。

---

## 任务 1：关闭注册邮箱验证

### 1.1 Supabase 控制台（浏览器操作）
- 进入 Supabase Dashboard → Authentication → Providers → Email
- 关闭 "Confirm email" 开关 → Save

### 1.2 前端注册流程简化
**文件**：[apps/web/app/(auth)/signup/page.tsx](file:///Users/liheng/Documents/AI职业发展路径规划/apps/web/app/(auth)/signup/page.tsx)
- 移除 `emailRedirectTo` 选项
- 移除 `setNotice(t("auth.verifyEmailSent"))` 分支
- 加 fallback：若 session 为空，自动 `signInWithPassword` 重试
- i18n：将 `auth.verifyEmailSent` 文案改为"注册成功，正在登录..."

---

## 任务 2：英语学习模块

### 2.1 数据模型（7 张新表）

**文件**：[apps/api/app/db/models.py](file:///Users/liheng/Documents/AI职业发展路径规划/apps/api/app/db/models.py)（末尾追加）

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `word_books` | 词书（CET-4/6/考研/雅思/托福） | code, name, level, total_words |
| `words` | 单词 | book_id, spelling, phonetic, pos, meaning, example_en/zh |
| `user_words` | 用户单词 SRS 状态 | user_id, word_id, status(new/learning/review/mastered), ease_factor, interval_days, repetitions, due_date |
| `word_review_logs` | 复习日志 | word_id, rating(again/hard/good/easy), prev/new_status |
| `listening_materials` | 听力材料 | title, transcript, translation, difficulty, questions(JSON) |
| `listening_attempts` | 听力答题记录 | material_id, user_answer, is_correct |
| `english_study_sessions` | 学习会话（打卡统计） | session_date, new_words, review_words, duration_minutes |

新表由 `Base.metadata.create_all()` 自动创建（[main.py:54](file:///Users/liheng/Documents/AI职业发展路径规划/apps/api/app/main.py#L54) lifespan 已有此逻辑），无需写 Alembic 迁移。

### 2.2 种子词库

**目录**：`apps/api/app/domains/english/seeds/`
- `cet4.json`（第一版先做 CET-4，200 词）
- 后续迭代补 `cet6.json` / `kaoyan.json` / `ielts.json` / `toefl.json`

JSON 结构：
```json
{
  "code": "cet4", "name": "CET-4 核心词汇", "level": "CET-4",
  "words": [
    {"spelling": "abandon", "phonetic": "/əˈbændən/", "pos": "v.",
     "meaning": "放弃；遗弃", "example_en": "...", "example_zh": "..."}
  ]
}
```

**Loader**：`apps/api/app/domains/english/seed.py`，幂等写入，在 [main.py](file:///Users/liheng/Documents/AI职业发展路径规划/apps/api/app/main.py) lifespan 中调用（参考 `seed_bucket_data` 模式）。

### 2.3 SRS 算法（SM-2 简化版）

**文件**：`apps/api/app/domains/english/srs.py`（纯函数）

4 档评分：again(重置) / hard(1.2x) / good(标准) / easy(加速)
- `again` → status=learning, interval=0, reps=0
- `good` → reps 0→1天, 1→3天, 2+→interval×ease
- reps≥5 标记 mastered
- ease_factor 范围 1.3~3.0

### 2.4 后端模块结构

**目录**：`apps/api/app/domains/english/`
```
__init__.py
router.py       # FastAPI 路由 (tags=["english"])
service.py      # 业务逻辑 + xxx_dict() 序列化
repository.py   # 数据访问
schemas.py      # Pydantic (camelCase alias)
srs.py          # SM-2 算法
seed.py         # JSON 词库 loader
prompts.py      # AI prompts (例句/听力生成)
seeds/cet4.json # 种子词库
```

在 [main.py](file:///Users/liheng/Documents/AI职业发展路径规划/apps/api/app/main.py) 注册：`app.include_router(english_router, prefix=settings.api_prefix)`

### 2.5 讯飞 TTS Provider

**目录**：`apps/api/app/providers/tts/`
```
base.py                 # TTSProvider ABC: synthesize(text, voice) -> bytes
xfyun_tts_provider.py   # 讯飞 TTS WebSocket 实现
```

- 鉴权复用 [xfyun_provider.py](file:///Users/liheng/Documents/AI职业发展路径规划/apps/api/app/providers/ai/xfyun_provider.py) 的 HMAC-SHA256 模式
- WebSocket URL：`wss://tts-api.xfyun.com/v2/tts`
- 复用现有 `XFYUN_API_KEY/SECRET/APP_ID`，无需新环境变量
- Settings 加 `xfyun_tts_ws_url` 和 `xfyun_tts_default_voice`

### 2.6 API 端点

**单词学习**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/english/books` | 词书列表（含进度统计） |
| GET | `/english/books/{book_id}/words` | 词书单词列表（附 SRS 状态） |
| POST | `/english/books/{book_id}/start` | 选词书，初始化 UserWord |
| GET | `/english/study/queue?book_id=&limit=20` | 今日学习队列（新词+到期复习） |
| POST | `/english/words/{word_id}/review` | 提交评分，更新 SRS |
| GET | `/english/words/{word_id}/pronunciation` | TTS 流式返回单词发音 mp3 |

**听力练习**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/english/listening` | 听力材料列表 |
| GET | `/english/listening/{material_id}` | 详情（原文/翻译/题目/音频URL） |
| POST | `/english/listening/{material_id}/attempts` | 提交答题 |
| GET | `/english/listening/{material_id}/audio` | 流式音频（懒合成并缓存） |
| POST | `/english/listening/generate` | AI 生成听力材料 |

**统计打卡**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/english/stats/today` | 今日概览（新学/复习/掌握） |
| GET | `/english/stats/streak` | 连续打卡天数 + 30 天趋势 |

### 2.7 前端页面

**目录**：`apps/web/app/(app)/english/`
```
page.tsx                           # 总览（今日统计 + 入口卡片）
words/page.tsx                     # 词书选择
words/[bookId]/page.tsx            # 卡片学习（翻转 + 4档评分）
listening/page.tsx                 # 听力列表
listening/[materialId]/page.tsx    # 听力答题
stats/page.tsx                     # 学习日历 + 打卡
```

**API 客户端**：`apps/web/lib/english.ts`

**导航集成**：
- [sidebar-nav.tsx](file:///Users/liheng/Documents/AI职业发展路径规划/apps/web/components/sidebar/sidebar-nav.tsx)：GROW 组加 `{ key: "english", href: "/english", icon: BookOpen, group: "grow" }`
- [auth-guard.tsx](file:///Users/liheng/Documents/AI职业发展路径规划/apps/web/components/auth-guard.tsx)：`APP_PREFIXES` 加 `"/english"`
- [i18n.tsx](file:///Users/liheng/Documents/AI职业发展路径规划/apps/web/lib/i18n.tsx)：加 `nav.english` + `english: {...}` 命名空间

---

## 实现顺序

1. **任务 1**：Supabase 控制台关闭邮箱验证 + 简化 signup 页面
2. **数据层**：models.py 加 7 张表
3. **种子词库**：cet4.json（200 词）+ seed.py loader + main.py 注册
4. **SRS 算法**：srs.py 纯函数
5. **后端 API**：schemas → repository → service → router → main.py 注册
6. **TTS Provider**：base.py + xfyun_tts_provider.py + 单词发音端点
7. **听力模块**：AI 生成 prompt + 听力 API + 音频缓存
8. **统计**：study session 维护 + today/streak 接口
9. **前端**：english.ts API 客户端 → 6 个页面 → 导航/守卫/i18n 集成
10. **测试**：后端 pytest + 前端手动验证 + 推送部署

---

## 验证方式

1. **任务 1**：注册新账号 → 无需邮箱确认 → 直接登录成功
2. **单词学习**：选 CET-4 词书 → 看到卡片队列 → 翻转卡片 → 4 档评分 → SRS 状态更新 → 发音播放
3. **听力练习**：听力列表 → 播放音频 → 答题 → 查看原文
4. **统计**：学习后 → 今日统计更新 → 连续打卡天数正确
5. **后端测试**：`cd apps/api && python -m pytest tests/test_english.py -v`
6. **部署**：git push → Render 自动部署 → 生产环境验证
