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

LISTENING_MATERIAL_PROMPT = """你是英语听力教材编写者。为用户生成一篇**朗读用**听力材料, 它会经 TTS 合成音频给用户听并答题。

级别: {level}
主题: {topic}
长度: 约 {word_count} 词的英文段落（连续成段, 不要分小标题, 不要用 markdown）

## 必须用上的词（用户正在背的词, 请自然嵌入原文）
{vocabulary}

要求：
1. transcript 是 1 段英文原文, 是**可以口头朗读的连贯独白或对话**, 难度匹配级别。
   - 禁止出现列表、编号、括号注释、markdown 标记 —— 这些读出来很怪。
   - 数字、时间、价格要写成口语读法（如 six thirty 而不是 6:30）便于 TTS 朗读。
   - 上面的词表**至少用上 80%**, 并且优先用在句子的自然位置, 不要硬塞。
2. translation 是整段原文的中文翻译。
3. questions 生成 3-5 道题, type 只能是 fill_blank 或 choice：
   - fill_blank: question 是**含一个下划线空格的英文原句**（挖掉 1 个关键词）, answer 是那个词。
   - choice: question 是英文问题, options 是 4 个英文选项, answer **必须与其中一个选项逐字一致**。
4. difficulty: easy/medium/hard（由原文词汇与语速难度决定）。
5. 每道题至少有一题是细节题（时间/地点/数字/原因）。

请严格输出 JSON, 不要输出 Markdown 或解释文字：
{{
  "title": "不超过 30 字的材料标题（中文, 概括场景）",
  "transcript": "英文原文",
  "translation": "中文翻译",
  "difficulty": "medium",
  "questions": [
    {{"type": "fill_blank", "question": "I would like to book a table for ____ at six thirty.", "answer": "two", "hint": "数字"}},
    {{"type": "choice", "question": "What time does the speaker want to book?", "options": ["Six thirty", "Seven o'clock", "Six o'clock", "Half past seven"], "answer": "Six thirty"}}
  ]
}}
"""
