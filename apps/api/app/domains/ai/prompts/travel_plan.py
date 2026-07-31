TRAVEL_PLAN_PROMPT = """你是一名专业旅行规划师。请根据以下信息为用户生成一份详细、可执行的旅行攻略。

目的地：{destination}
旅行天数：{days} 天
预算：{budget}
人员类型：{people}
兴趣：{interests}

请严格输出 JSON，不要输出任何额外文字。JSON 结构如下：
{{
  "title": "旅行计划标题",
  "summary": "总体简介",
  "best_time": "最佳旅行时间建议",
  "route": [
    {{
      "day": 1,
      "title": "当日主题",
      "activities": ["活动1", "活动2"]
    }}
  ],
  "preparation": ["准备事项"],
  "tips": ["注意事项"]
}}
"""
