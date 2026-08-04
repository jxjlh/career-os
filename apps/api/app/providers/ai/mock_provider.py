import json

from app.providers.ai.base import AIProvider


class MockAIProvider(AIProvider):
    """开发/测试环境 mock provider.

    识别常见 prompt 类型, 返回结构化 JSON, 让 Planner/Coach/GrowthPlan 等模块
    在离线环境也能跑通完整路径. 不能识别时回落到通用 JSON.
    """

    name = "mock"

    async def complete(self, messages, response_format=None, **kwargs) -> str:
        system = messages[0].get("content", "") if messages else ""
        last = messages[-1].get("content", "") if messages else ""

        # 周计划教练 prompt
        if "人生周计划教练" in system or "周计划" in last:
            return json.dumps(
                {
                    "title": "本周计划 (Mock)",
                    "weeklyFocus": "本周从一件小事开始, 完成比完美更重要。",
                    "rationale": "测试环境示例计划, 按技能差距与目标优先级排了 3 天任务 + 周日复盘。",
                    "tips": ["每天专注 1 小时", "周日晚做一次回顾"],
                    "tasks": [
                        {
                            "day": 1,
                            "title": "学习 SQL 基础语法",
                            "description": "为什么做: SQL 是数据岗必备\n怎么做: 跟官方教程过一遍 SELECT/JOIN",
                            "taskType": "learning",
                            "difficulty": "easy",
                            "estimatedMinutes": 60,
                            "priority": "high",
                            "estimatedOutcome": "能独立写 SELECT 查询",
                            "sourceType": "skill",
                            "sourceId": "",  # 测试环境无真实 skill id, 走 none 分支
                            "resourceSuggestion": "https://www.sqltutorial.org/",
                        },
                        {
                            "day": 3,
                            "title": "练习 SQL 实战 5 题",
                            "description": "为什么做: 巩固语法\n怎么做: LeetCode SQL 题 5 道",
                            "taskType": "practice",
                            "difficulty": "medium",
                            "estimatedMinutes": 90,
                            "priority": "high",
                            "estimatedOutcome": "熟练 JOIN/子查询",
                            "sourceType": "none",
                            "sourceId": "",
                            "resourceSuggestion": "",
                        },
                        {
                            "day": 7,
                            "title": "周回顾: 整理笔记 + 复盘",
                            "description": "为什么做: 形成反思习惯\n怎么做: 写一段本周总结",
                            "taskType": "review",
                            "difficulty": "easy",
                            "estimatedMinutes": 30,
                            "priority": "low",
                            "estimatedOutcome": "本周学习总结",
                            "sourceType": "none",
                            "sourceId": "",
                            "resourceSuggestion": "",
                        },
                    ],
                },
                ensure_ascii=False,
            )

        # 通用 JSON 回复 (Coach / GrowthPlan / Travel 等)
        if response_format == "json_object":
            return (
                '{"analysis":"基于当前数据给出的开发模式分析。",'
                '"content":"基于当前数据给出的开发模式分析。",'
                '"summary":"开发模式摘要",'
                '"advice":[{"title":"记录今日瞬间","detail":"保持记录习惯"}],'
                '"title":"开发模式复盘",'
                '"highlights":["当前处于开发模式"],'
                '"suggestions":["继续使用真实 AI 配置后生成个性化内容"],'
                '"reflection":"以上内容为开发模式示例。",'
                '"metrics":{}}'
            )
        return f"（开发模式示例回复）我收到了你的问题：{last[:80]}。正式版将接入讯飞星火 Spark-X2-Flash。"

    async def healthcheck(self) -> bool:
        return True
