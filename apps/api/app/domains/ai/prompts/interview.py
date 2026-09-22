"""面试中心 Prompt 集合.

设计原则（与本项目其余 AI 链路一致）:
- 打分/降级的确定性逻辑不交给模型，模型只负责"理解与生成"。
- 所有 prompt 强制返回可被 extract_json 解析的单个 JSON 对象。
- 铁律：**题目必须同时锚定简历事实与 JD 要求**，禁止出脱离二者的通用题。
"""

# ── 简历事实抽取 ───────────────────────────────────────────────
RESUME_FACTS_PROMPT = """你是一名资深招聘官，擅长从简历中提炼可用于面试追问的事实依据。

请阅读以下简历原文，抽取结构化信息。

简历原文：
{resume_text}

抽取要求：
- 只提取简历里真实存在的内容，**严禁脑补、推测或美化**。简历没写的字段留空数组/空字符串。
- metrics 必须是简历里出现过的具体数字（如"转化率提升 23%""管理 5 人团队""GMV 800 万"）。
  没有数字就留空数组，不要用"显著增长"这类无数字的表述充当 metrics。
- risks 填写简历里可能被面试官质疑的点：如职责描述含糊、时间断档、成果缺量化、
  岗位与目标岗位关联弱、title 与实际内容不匹配等。
- 每家公司/每段经历保留 2-4 条 highlights。

请严格只返回 JSON，不要任何其他文字：
{{
  "name": "候选人姓名，无则留空字符串",
  "yearsOfExperience": "工作年限，简历没写就留空字符串",
  "currentTitle": "最近一份职位名称",
  "experiences": [
    {{
      "org": "公司/组织名称",
      "title": "职位",
      "period": "起止时间",
      "highlights": ["这段经历的 2-4 个要点，忠于原文"],
      "metrics": ["简历里出现的具体量化数据"]
    }}
  ],
  "projects": [
    {{
      "title": "项目名称",
      "role": "在项目中的角色",
      "description": "一句话描述",
      "metrics": ["项目相关的具体数字"]
    }}
  ],
  "skills": ["技能关键词"],
  "education": [
    {{
      "school": "学校",
      "major": "专业",
      "degree": "学历",
      "period": "起止时间"
    }}
  ],
  "notableMetrics": ["全篇最有说服力的量化成果，按说服力降序"],
  "risks": ["简历中可能被质疑的薄弱点"]
}}
"""


# ── JD 归一：把搜索回来的碎片整理成标准 JD ─────────────────────
JD_NORMALIZE_PROMPT = """你是一名招聘分析师。下面是针对某个岗位从公开渠道检索到的招聘信息片段，
请把它们归纳成一份结构清晰、可供模拟面试使用的 JD。

目标岗位：{role}
目标公司（可能为空）：{company}

检索到的原始信息：
{search_results}

归纳要求：
- 只保留检索结果里明确出现的要求，**不要凭常识补充**。
- 若检索结果里根本没有某类信息（如薪资、公司名），对应字段留空字符串，不要编造。
- hardRequirements 是门槛条件（学历、年限、必备技能）；preferred 是加分项。分不清时放 hardRequirements。
- keywords 提取这个岗位的领域黑话与工具名词，用于后续面试覆盖度检查。

请严格只返回 JSON，不要任何其他文字：
{{
  "title": "岗位名称",
  "company": "公司名称，检索不到留空字符串",
  "seniority": "职级/经验要求，如 3-5 年 / 高级 / 应届",
  "industry": "行业",
  "responsibilities": ["核心职责，每条一句话"],
  "hardRequirements": ["硬性要求"],
  "preferred": ["加分项"],
  "keywords": ["领域关键词/工具名"],
  "confidence": "high | medium | low，依据检索信息是否直接命中该岗位"
}}
"""


# ── JD 兜底：检索失败时按岗位名推断 ────────────────────────────
JD_INFER_PROMPT = """你是一名熟悉中国职场的招聘分析师。我们没有找到「{role}」的真实招聘信息，
请基于你对这个岗位在市场上的普遍认知，推断一份标准 JD，用于模拟面试。

目标公司（可能为空）：{company}

要求：
- 这是**推断结果，不是某家公司的真实招聘要求**。按该岗位在行业中的通用标准写，不要虚构公司特有信息。
- responsibilities 与 hardRequirements 要具体到这里能直接拿去提问的程度，不要写"具备良好沟通能力"这类空话。
- confidence 字段固定填 "inferred"，前端会据此标注"推断，仅供参考"。

请严格只返回 JSON，不要任何其他文字：
{{
  "title": "岗位名称",
  "company": "",
  "seniority": "该岗位常见的职级/经验要求",
  "industry": "该岗位常见行业",
  "responsibilities": ["核心职责"],
  "hardRequirements": ["硬性要求"],
  "preferred": ["加分项"],
  "keywords": ["领域关键词/工具名"],
  "confidence": "inferred"
}}
"""


# ── 双绑定出题：题目的核心约束 ─────────────────────────────────
INTERVIEW_QUESTION_PROMPT = """你是一名即将面试候选人的资深面试官。你要出的每一道题，都必须同时满足两个条件：

【条件一：锚定简历】题目必须钩住候选人简历里**真实写过**的一段经历、一个项目或一个数字。
  简历没有写过的东西不许假设他做过。这样他才能用真实素材作答，面试官才能验证真伪。

【条件二：咬住 JD】题目必须用于考察 JD 中的某一条具体要求，答完就能判断这条要求是否达标。

候选岗位 JD：
{jd_text}

JD 结构化要求：
{jd_requirements}

候选人简历事实：
{resume_facts}

简历薄弱点（这些地方容易被追问，可作为出题素材）：
{resume_risks}

题型模式：{mode}
- behavioral：行为题，考察做事方式与团队协作
- star：要求用 STAR 结构作答的情景题
- technical：考察专业深度与方法论

出题要求：
- 共 {question_count} 题，按"自我介绍/暖场 → 核心经历深挖 → 岗位匹配度验证 → 薄弱点攻防"的顺序排列。
- 每题的 question 字段里**要点名具体的经历或项目**（例如"你在 XX 公司主导的 XX 项目"），
  不要出现笼统的"请介绍一下你的相关经验"这种题。
- jdRequirement 必须引用 JD 里的一条具体要求，写清是第几条（来自上面的 jd_requirements 列表）。
- resumeHook 写清这题钩住了简历的哪一段（公司/项目/原文片段）。
- intent 写清"面试官想通过这题验证什么"，一句话说破考察意图。
- expectedKeywords 列 2-5 个优秀回答应该出现的关键词或结构要点。
- followUp 预设一条追问：**当候选人答得空泛、没给证据或避重就轻时用**。
- gap 字段：若这题考察的 JD 要求，在候选人简历里**找不到任何对应证据**，填 true（这是暴露短板题），否则 false。
- 至少要有 1 道 gap=true 的题，用来测试他面对能力缺口的表现。
- 难度整体控制在「{difficulty}」。

请严格只返回 JSON，不要任何其他文字：
{{
  "questions": [
    {{
      "question": "具体题干，点名简历中的真实经历",
      "jdRequirement": "考察 JD 的哪一条要求",
      "resumeHook": "钩住简历的哪段经历/原文",
      "intent": "这道题想验证什么",
      "expectedKeywords": ["关键词"],
      "followUp": "预设追问",
      "gap": false
    }}
  ]
}}
"""


# ── 动态追问：判断回答是否值得追一层 ───────────────────────────
FOLLOWUP_DECISION_PROMPT = """你是一名正在面试候选人的面试官，刚听完他对某个问题的回答。

题目：{question}
考察意图：{intent}
期待听到的关键词：{expected_keywords}
候选人的回答：
{answer}

这是本题的第 {round} 轮追问（最多追加 {max_rounds} 轮，超过就必须收尾）。

判断规则：
- 回答空泛（只讲道理没讲具体事）、没有量化结果、没有讲清个人贡献（只说"我们"不说"我"）、
  明显跑题或回避问题 → 需要追问。
- 回答已经给出了具体事例 + 个人动作 + 可验证结果 → 不需要追问，可以进入下一题。
- 已经追满最大轮数 → 一定不需要再追问。
- followUp 措辞要像真人面试官顺势追问，自然口语，不要像考官宣读条款。

请严格只返回 JSON，不要任何其他文字：
{{
  "needFollowUp": true,
  "reason": "一句话说明为什么要追/为什么不追",
  "followUp": "追问的话术；needFollowUp 为 false 时填空字符串"
}}
"""


# ── 面评：加入 JD 匹配度与简历优化建议 ─────────────────────────
INTERVIEW_FEEDBACK_PROMPT = """你是一名资深面试官，刚结束一场模拟面试。请基于这场问答、
候选人简历、以及目标岗位 JD，给出一份既评面试表现、又评岗位匹配度的报告。

目标岗位 JD：
{jd_text}

JD 结构化要求：
{jd_requirements}

候选人简历事实：
{resume_facts}

面试问答记录（含追问过程）：
{qa_text}

评分要求：
- 五个维度按 0-100 打分，comment 要具体到他的原话，不要写"表达尚可"这种空话。
- jdMatchScore 是这场面试展现出来的**岗位匹配度**（0-100）：不是看他简历写得多好，
  而是看他在答题过程中，实际证明了自己满足多少 JD 要求。没答上来的要求要拉低分数。
- jdCoverage 逐条核对 jd_requirements 里的每条要求：covered（现场给出了可信证据）、
  partial（提到了但缺证据/不完整）、missing（没答上来或明确不具备）。
  evidence 引用他回答或简历里的原话，没有就写"无证据"。
- resumeAdvice 是最有价值的部分：**针对那些 JD 要求了但简历没体现的点**，告诉他在简历上怎么补。
  suggestion 要具体到"在哪里加一句话"，exampleLine 直接给一句可抄进简历的中文范例
  （必须基于他简历里已有的真实经历改写，**不许编造他没做过的事**；若他确实完全没相关经历，
  suggestion 里就明确说明建议他去积累，exampleLine 填空字符串）。

请严格只返回 JSON，不要任何其他文字：
{{
  "overall_score": 78,
  "dimensions": {{
    "structure": {{"score": 80, "comment": "..."}},
    "star": {{"score": 75, "comment": "..."}},
    "expression": {{"score": 82, "comment": "..."}},
    "technical_depth": {{"score": 70, "comment": "..."}},
    "time_control": {{"score": 78, "comment": "..."}}
  }},
  "jdMatchScore": 72,
  "jdCoverage": [
    {{"requirement": "JD 要求原文", "verdict": "covered | partial | missing", "evidence": "他回答或简历里的原话"}}
  ],
  "strengths": "这场面试中最突出的优势，结合他的具体回答说明",
  "improvements": "最需要改的 2-3 个点，按优先级排序",
  "sample_answer": "挑他答得最弱的一题，示范一句更好的回答（用他自己简历里的素材改）",
  "resumeAdvice": [
    {{
      "requirement": "JD 有要求但简历没体现的点",
      "problem": "简历现在为什么没覆盖到",
      "suggestion": "建议怎么补，具体到第几段加什么",
      "exampleLine": "可直接抄进简历的一句话；他确实没有相关经历时填空字符串"
    }}
  ]
}}
"""
