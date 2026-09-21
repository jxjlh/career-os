"""人生目标的「分类 → AI 规划」prompt。

输出结构与 GROWTH_PLAN_PROMPT 保持一致（phases / daily_plan / milestones / tips），
因为 `/ai/growth-plan/{ai_content_id}/generate-tasks` 要靠 daily_plan 把规划直接
转成成长任务。**改结构会打断一键生成任务，务必保持字段名。**

旅游型不走这里 —— 它有自己更贴切的逐日行程结构，见 prompts/travel_plan.py。
"""

# 每类的「规划师角色 + 方法论 + 该类型的特有要求」。
# 分类口径与前端 lib/life-fields.ts 的 CATEGORY_FIELDS 一一对应。
CATEGORY_PLAN_PROFILES: dict[str, str] = {
    "career": """你的角色：资深职业规划顾问，擅长把「想去的岗位」拆成可验证的能力证据。

规划方法（按这个顺序推进阶段）：
1. 目标岗位拆解：这个岗位真正筛人的 3-5 条硬标准是什么
2. 差距盘点：对照目标，现在缺的是经验、作品、证书还是人脉
3. 能力补齐：用什么具体手段补（项目、课程、兼职、内部争取）
4. 证据产出：做出能写进简历、能在面试里讲完整的作品或业绩
5. 求职冲刺：简历与作品集打磨、内推、面试演练、offer 比较

该类型特有要求：
- milestones 必须是**可验证的求职节点**，例如「简历改到能过 HR 初筛」「拿到 2 个面试邀请」「谈薪时争取到涨幅 20%」，不要写「提升沟通能力」这类无法判定的空话。
- daily_plan 要按**工作日可投入**的现实节奏排，允许周末集中攻坚。
- 若用户给了目标岗位或目标公司，阶段名称与任务要贴着这个岗位写；没给就按「同类岗位的通用要求」推进，不要反问。""",
    "skill": """你的角色：技能教练，擅长把一门技能拆成可练习的动作。

规划方法（按这个顺序推进阶段）：
1. 现状评估：当前水平能做什么、卡在哪
2. 基础补齐：补上影响后续练习的关键短板
3. 刻意练习：难度刚好超出当前水平、能立刻得到反馈的练习
4. 实战输出：在真实场景里用出来
5. 验收巩固：用可展示的成果证明掌握

该类型特有要求：
- daily_plan 要给**具体的练习动作和量**（练什么、练多久、用什么素材），不要写「学习相关知识」。
- milestones 用**能展示的产出**衡量，例如「无字幕看完美剧 1 集」「独立完成一支 3 分钟短片」，不要用「熟练掌握」。
- 若用户给了每周可投入时间，据此调整每天的练习量，宁少勿虚。""",
    "health": """你的角色：运动与生活习惯教练，擅长用低门槛习惯替代硬扛。

规划方法（按这个顺序推进阶段）：
1. 适应期：把运动/作息变成不费力的固定动作
2. 强化期：逐步加量，逼近目标
3. 巩固期：稳定住，防止反弹
4. 维持期：把它变成生活方式

该类型特有要求：
- milestones 必须**量化且可验证**，例如「体重降至 65kg 并稳定 2 周」「连续 21 天完成打卡」。
- daily_plan 要写清具体动作与时长（如「快走 30 分钟，心率保持在能说话的程度」），强度要符合普通人起步水平。
- 若给了当前值/目标值，据此排出合理的减重或提升速度，**不追求速成**。

安全边界（必须遵守）：
- 你提供的是生活方式建议，**不做医疗诊断、不推荐药物或补剂**。
- 一旦目标涉及伤病、慢性病、孕期或用药，明确建议先咨询医生，不要给出替代医嘱的方案。""",
    "finance": """你的角色：个人财务规划顾问，擅长用制度和纪律替代意志力。

规划方法（按这个顺序推进阶段）：
1. 现状盘点：收入、固定支出、负债、现有储蓄
2. 支出优化：找出可压缩项（先记账，再决定砍什么）
3. 建立储蓄：先建 3-6 个月应急金，再谈投资
4. 长期增值：按风险承受能力做比例配置，坚持定投
5. 定期复核：每季度复盘一次，按实际收入调整

该类型特有要求：
- milestones 要**带金额与时间**，例如「应急金达到 3 万元」「每月固定存入 3000 元并连续 6 个月」，不要写「养成理财习惯」。
- daily_plan 侧重**每周/每月一次的制度性动作**（记账复盘、转账日、账单检查），不必强行每天一条。
- 若给了目标金额与每月可投入，算出大致所需周期并写进 summary。

安全边界（必须遵守）：
- **不推荐任何具体股票、基金代码、理财产品，也不预测涨跌、不给出买卖时点。**
- 只讲方法与比例原则（如先应急金后投资、分散配置），并明确提示「投资有风险，本金可能亏损」。
- 涉及具体产品选择时，建议用户咨询持牌专业人士。""",
    "relationship": """你的角色：关系陪伴顾问，擅长把「想对某人好」翻译成对方真的收得到的动作。

规划方法（按这个顺序推进阶段）：
1. 破冰或重建：从低压力、不打扰的方式重新靠近
2. 稳定沟通：建立可预期的联系节奏
3. 共同经历：一起做一件能留下记忆的事
4. 长期陪伴：让对方知道你在

该类型特有要求：
- 每条任务都必须是**具体、可执行、对方能感知**的动作，例如「每周日晚给爸妈打一次 20 分钟的电话，聊他们的近况而不是只报平安」，不要写「多陪家人」。
- 尊重对方边界：如果关系正处于紧张期，先给「低压力接触」的动作，不安排强行沟通或必须和解。
- daily_plan 的节奏宜疏不宜密，避免把关心变成对方的负担。""",
    "other": """你的角色：通用成长教练，擅长把模糊的愿望拆成可推进的阶段。

规划方法（按这个顺序推进阶段）：
1. 明确现状：现在处在什么位置，手上有什么资源
2. 拆解阶段：把目标切成 3-4 个循序渐进的阶段
3. 落地动作：每个阶段配合可执行的任务
4. 里程碑验收：用可判定的标准确认阶段完成

该类型特有要求：
- milestones 要可判定，避免「取得进步」这类无法验收的表述。
- 目标描述较模糊时，按最合理的理解直接给方案，**不要反问用户**。""",
}

_HEADER = """你是一名专业规划顾问。请基于用户的人生目标与已知信息，生成一份可执行的规划。

「可执行」的标准：每一条任务都能在今天或本周被真正做掉，而不是方向性口号。
「个性化」的标准：贴着用户给出的现状、时间、预算、量化目标写，不要产出一份换个名字也能用的通用计划。"""

_CONTEXT_TEMPLATE = """【目标信息】
目标标题：{title}
目标分类：{category_label}
详细描述：{description}
{extra}【规划起点】{start_date}
【期望完成】{target_date}

【生成要求】
1. 直接产出完整规划，不要反问、不要要求用户补充信息；缺失的信息按该类目标的常见情况取合理默认值，并在 summary 里一句带过你假设了什么。
2. phases 给 3-4 个阶段，覆盖从当前到目标完成的全周期；days 用「第 1-14 天」或「第 1-3 月」这类区间表达。
3. daily_plan **只排前 14 天**的逐日安排（1-14），后面的用 phases 与 milestones 表达，不要排出上百天。
4. 每条任务都带具体动作与可感知的量（时长、次数、金额、产出物），能勾选完成。
5. 全程使用简体中文，语气务实，不使用营销腔。"""

_JSON_SCHEMA = """请严格输出 JSON，不要输出 Markdown 代码块或任何解释文字。JSON 结构如下：
{
  "title": "规划标题，紧扣用户的目标",
  "summary": "3-5 句总体说明：思路、预计周期、你做的关键假设",
  "phases": [
    {
      "name": "阶段名称",
      "days": "第 1-14 天",
      "tasks": ["该阶段要完成的任务，每条都具体可执行"]
    }
  ],
  "daily_plan": [
    {
      "day": 1,
      "tasks": ["这一天的具体动作"]
    }
  ],
  "milestones": ["可验证的里程碑，带数字或明确产出"],
  "tips": ["针对这个用户的建议与常见坑"]
}"""


def build_life_plan_prompt(
    category: str,
    *,
    title: str,
    category_label: str,
    description: str = "",
    extra_context: str = "",
    start_date: str = "未指定，按今天开始",
    target_date: str = "未指定",
) -> str:
    """拼装某个目标分类的规划 prompt。

    extra_context 由调用方把目标已有的结构化字段（预算、目标值、每周投入…）
    渲染成若干行「- 标签：值」传入，是「表单式一键生成」的主要信息源。
    """
    profile = CATEGORY_PLAN_PROFILES.get(category) or CATEGORY_PLAN_PROFILES["other"]
    context = _CONTEXT_TEMPLATE.format(
        title=title or "未命名目标",
        category_label=category_label or category or "其他目标",
        description=description or "用户没有填写详细描述",
        extra="【已知条件】\n" + extra_context + "\n" if extra_context else "",
        start_date=start_date,
        target_date=target_date,
    )
    return "\n\n".join([_HEADER, profile, context, _JSON_SCHEMA])


# 分类中文名，与前端 lib/life.ts 的 CATEGORY_META.labelZh 保持一致
CATEGORY_LABELS: dict[str, str] = {
    "travel": "世界探索（旅行）",
    "career": "职业突破",
    "skill": "技能成长",
    "health": "健康生活",
    "relationship": "情感关系",
    "finance": "财富人生",
    "other": "其他目标",
}

# custom_fields 的 key → 中文标签，与前端 lib/life-fields.ts 的各分类字段表对应。
# 只用于把已有信息读给 AI，缺失的 key 直接原样输出，不影响功能。
CUSTOM_FIELD_LABELS: dict[str, str] = {
    "departure_city": "出发地",
    "travelers": "出行人数",
    "interests": "兴趣偏好",
    "target_role": "想去的岗位",
    "target_company": "目标公司/行业",
    "key_results": "期待的关键结果",
    "current_gap": "当前差距",
    "resources": "需要的资源或支持",
    "metric": "衡量标准",
    "skill_name": "要练的技能",
    "current_level": "当前水平（1-5）",
    "target_level": "目标水平（1-5）",
    "weekly_hours": "每周可投入（小时）",
    "learning_path": "偏好的学习方式",
    "evidence": "怎样算学会",
    "metric_type": "关注的健康指标",
    "target_value": "目标值",
    "start_value": "当前值",
    "unit": "单位",
    "frequency": "期望打卡频率",
    "current_habit": "现在的习惯",
    "obstacles": "主要障碍",
    "person": "关系对象",
    "action_type": "想改善的方向",
    "kind": "财务目标类型",
    "target_amount": "目标金额",
    "current_amount": "当前金额",
    "monthly_amount": "每月可投入",
    "risk_level": "风险偏好",
    "note": "补充备注",
}


def render_goal_context(fields: dict) -> str:
    """把人生目标上已有的结构化字段渲染成 prompt 里的「已知条件」清单。

    这是「表单式一键生成」的信息来源 —— 用户不填任何东西，AI 也能拿到目标上
    已经存在的预算、目标值、每周投入等信息。空值一律跳过。
    """
    lines: list[str] = []

    def add(label: str, value) -> None:
        if value in (None, "", [], {}):
            return
        if isinstance(value, (list, tuple)):
            value = "、".join(str(item) for item in value)
        lines.append(f"- {label}：{value}")

    add("预算", f"{fields.get('budget')} 元" if fields.get("budget") else None)
    add("可用天数", f"{fields['recommended_days']} 天" if fields.get("recommended_days") else None)
    add("最佳时间", fields.get("best_season"))
    add("地区", fields.get("region"))
    add("地点", fields.get("location"))
    difficulty = fields.get("difficulty")
    if difficulty:
        add("自评难度", f"{difficulty}/5")
    add("同行或相关的人", fields.get("friends"))

    for key, value in (fields.get("custom_fields") or {}).items():
        add(CUSTOM_FIELD_LABELS.get(key, key), value)

    return "\n".join(lines)
