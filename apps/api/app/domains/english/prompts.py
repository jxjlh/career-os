"""English Learning AI Prompts."""

WORD_EXAMPLE_PROMPT = """你是英语学习助手。为以下单词生成 1 个地道例句 + 中文翻译 + 1 句联想记忆法。

单词: {word}
释义: {meaning}
词性: {pos}

要求：
1. example_en 是 1 句 8-15 词的英文例句, 用词简洁地道
2. example_zh 是例句中文翻译
3. mnemonic 是 1 句中文联想记忆法 (<=30 字), 帮助记忆拼写或含义

请严格输出 JSON, 不要任何解释文字：
{{
  "example_en": "...",
  "example_zh": "...",
  "mnemonic": "..."
}}
"""

LISTENING_MATERIAL_PROMPT = """你是英语听力教材编写者。按用户级别生成一篇听力材料。

级别: {level} (CET-4/CET-6/考研/雅思/托福)
主题: {topic} (如: 校园生活/职场对话/旅行/科技)
长度: 约 {word_count} 词的英文段落

要求：
1. transcript 是 1 段英文原文, 难度匹配级别
2. translation 是中文翻译
3. questions 是 3-5 道题, type 为 fill_blank 或 choice
   - fill_blank: question 引用原文, 从中挖空 1 个关键词
   - choice: 4 个选项, 1 个正确答案
4. difficulty: easy/medium/hard

请严格输出 JSON：
{{
  "title": "...",
  "transcript": "...",
  "translation": "...",
  "difficulty": "medium",
  "questions": [
    {{"type": "fill_blank", "question": "...", "answer": "...", "hint": "..."}}
  ]
}}
"""
