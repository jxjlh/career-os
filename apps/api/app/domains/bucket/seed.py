"""Bucket List 种子数据.

dev/test 环境启动时通过 lifespan 幂等写入, 保证 /life/bucket 页面有可消费内容.
分类按需求 12 大类, 每类预置若干高人气条目 (含坐标/预算/季节), 覆盖旅行/挑战/成长.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import BucketCategory, BucketItem

# (name, icon, color, sort)
SEED_CATEGORIES: list[tuple[str, str, str, int]] = [
    ("旅行", "✈️", "#3B82F6", 1),
    ("成长", "🌱", "#10B981", 2),
    ("学习", "📚", "#8B5CF6", 3),
    ("摄影", "📷", "#F59E0B", 4),
    ("挑战", "🎯", "#EF4444", 5),
    ("爱情", "❤️", "#EC4899", 6),
    ("家庭", "🏡", "#14B8A6", 7),
    ("事业", "💼", "#6366F1", 8),
    ("财富", "💰", "#EAB308", 9),
    ("公益", "🤝", "#22C55E", 10),
    ("运动", "🏃", "#F97316", 11),
    ("体验", "✨", "#A855F7", 12),
]

# (category_name, title, subtitle, difficulty, estimated_cost, estimated_days,
#  best_season, country, city, latitude, longitude, tags, popularity)
SEED_ITEMS: list[tuple] = [
    # ── 旅行 ──
    ("旅行", "去一次西藏", "在布达拉宫前感受信仰的力量", 4, "8000-15000", 10,
     "5-10月", "中国", "拉萨", 29.65, 91.13, ["高原", "信仰", "自然"], 980),
    ("旅行", "看一次极光", "在冰岛或北欧追猎夜空之光", 4, "15000-30000", 7,
     "11-3月", "冰岛", "雷克雅未克", 64.13, -21.94, ["极光", "北欧", "冬季"], 950),
    ("旅行", "去南极", "踏足地球最后的净土", 5, "50000-100000", 14,
     "11-3月", "南极", "", -77.85, 166.67, ["南极", "极地", "探险"], 720),
    ("旅行", "环球旅行", "用一年时间走遍六大洲", 5, "100000+", 365,
     "全年", None, None, None, None, ["环球", "长途", "背包客"], 880),
    ("旅行", "去一次马尔代夫", "在透明海水里看珊瑚与星辰", 3, "10000-30000", 6,
     "10-4月", "马尔代夫", "马累", 4.17, 73.51, ["海岛", "度假", "潜水"], 900),
    # ── 挑战 ──
    ("挑战", "跳一次伞", "从 4000 米高空自由落体", 5, "2000-5000", 1,
     "全年", "中国", None, None, None, ["极限", "空中", "刺激"], 850),
    ("挑战", "坐一次热气球", "在卡帕多奇亚看日出云海", 3, "1500-4000", 1,
     "4-10月", "土耳其", "卡帕多奇亚", 38.64, 34.83, ["空中", "日出", "浪漫"], 820),
    ("挑战", "完成一次马拉松", "42.195 公里的自我超越", 4, "500-2000", 1,
     "全年", None, None, None, None, ["跑步", "坚持", "耐力"], 780),
    ("挑战", "潜水考证", "潜入深海与鱼群共舞", 3, "3000-8000", 4,
     "全年", "泰国", "涛岛", 10.10, 99.84, ["潜水", "海洋", "考证"], 760),
    # ── 成长 ──
    ("成长", "学会一门乐器", "从零掌握吉他或钢琴", 3, "1000-5000", 90,
     "全年", None, None, None, None, ["音乐", "技能", "坚持"], 700),
    ("成长", "写一本书", "把自己的人生故事出版", 5, "0-5000", 180,
     "全年", None, None, None, None, ["写作", "创作", "输出"], 650),
    ("成长", "学会一门外语", "能流利对话第二外语", 4, "2000-10000", 180,
     "全年", None, None, None, None, ["语言", "学习", "沟通"], 750),
    # ── 学习 ──
    ("学习", "读完 100 本书", "建立自己的阅读体系", 3, "1000-5000", 365,
     "全年", None, None, None, None, ["阅读", "知识", "习惯"], 720),
    ("学习", "考取一个专业认证", "PMP / CFA / CPA 任一", 4, "2000-10000", 120,
     "全年", None, None, None, None, ["认证", "职业", "专业"], 680),
    # ── 摄影 ──
    ("摄影", "拍一次星空延时", "在无人区记录银河流转", 4, "2000-10000", 3,
     "全年", None, None, None, None, ["星空", "延时", "风光"], 690),
    ("摄影", "办一次个人影展", "把得意之作挂上墙", 4, "5000-20000", 60,
     "全年", None, None, None, None, ["展览", "创作", "分享"], 600),
    # ── 体验 ──
    ("体验", "看一场极昼", "在北极圈体验太阳不落的奇迹", 3, "10000-25000", 5,
     "6-7月", "挪威", "特罗姆瑟", 69.65, 18.96, ["极昼", "北极", "奇观"], 640),
    ("体验", "住一晚沙漠星空营地", "在撒哈拉听沙与风的对话", 3, "3000-8000", 2,
     "10-3月", "摩洛哥", "梅尔祖卡", 31.10, -4.01, ["沙漠", "星空", "异域"], 660),
    ("体验", "参加一次当地节日", "在异国融入人群狂欢", 3, "3000-10000", 5,
     "全年", "西班牙", "潘普洛纳", 42.82, -1.64, ["节日", "文化", "狂欢"], 580),
    # ── 运动 ──
    ("运动", "登顶一座雪山", "5000 米级雪山攀登", 5, "8000-20000", 7,
     "5-9月", "中国", "四姑娘山", 31.11, 102.91, ["登山", "雪山", "极限"], 620),
    ("运动", "学会冲浪", "在浪尖找到平衡", 3, "2000-6000", 5,
     "全年", "印度尼西亚", "巴厘岛", -8.41, 115.19, ["冲浪", "海洋", "平衡"], 590),
    # ── 家庭 ──
    ("家庭", "带父母旅行一次", "用一次旅行回报养育之恩", 3, "5000-20000", 7,
     "全年", None, None, None, None, ["亲情", "感恩", "陪伴"], 850),
    # ── 爱情 ──
    ("爱情", "和爱人看一次日出", "在海边或山顶迎接第一缕光", 2, "0-2000", 1,
     "全年", None, None, None, None, ["浪漫", "日出", "陪伴"], 700),
    # ── 公益 ──
    ("公益", "参加一次支教", "把知识带给偏远山区的孩子", 3, "1000-3000", 14,
     "全年", None, None, None, None, ["教育", "奉献", "爱心"], 560),
    # ── 事业 ──
    ("事业", "创办一家公司", "从 0 到 1 做自己的事业", 5, "10000+", 365,
     "全年", None, None, None, None, ["创业", "事业", "梦想"], 640),
    # ── 财富 ──
    ("财富", "实现财务自由", "被动收入覆盖生活支出", 5, "0", 1825,
     "全年", None, None, None, None, ["理财", "投资", "自由"], 720),
]


def seed_bucket_data(db: Session) -> None:
    """幂等写入分类与条目. 已存在的 name/title 跳过."""
    name_to_cat: dict[str, BucketCategory] = {
        c.name: c for c in db.query(BucketCategory).all()
    }
    for name, icon, color, sort in SEED_CATEGORIES:
        if name not in name_to_cat:
            cat = BucketCategory(name=name, icon=icon, color=color, sort=sort)
            db.add(cat)
            db.flush()
            name_to_cat[name] = cat

    existing_titles = {t for (t,) in db.query(BucketItem.title).all()}
    for row in SEED_ITEMS:
        (cat_name, title, subtitle, difficulty, cost, days,
         season, country, city, lat, lng, tags, popularity) = row
        if title in existing_titles:
            continue
        cat = name_to_cat.get(cat_name)
        if cat is None:
            continue
        db.add(
            BucketItem(
                category_id=cat.id,
                title=title,
                subtitle=subtitle,
                description=subtitle,
                difficulty=difficulty,
                estimated_cost=cost,
                estimated_days=days,
                best_season=season,
                country=country,
                city=city,
                latitude=lat,
                longitude=lng,
                tags=tags,
                tips=None,
                popularity=popularity,
                status="published",
            )
        )
    db.commit()
