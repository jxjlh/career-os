"""Coach 工具上下文构建器.

惰性导入各领域 service/repository, 避免循环依赖.
每个构建器返回精简文本摘要, 拼入 coach system prompt 供 AI 引用.
"""

from sqlalchemy.orm import Session

from app.domains.life.repository import (
    LifeGoalRepository,
    LifeRecordRepository,
)


async def build_travel_context(db: Session, user_id: str) -> str:
    goals = LifeGoalRepository(db).list_geotagged(user_id)
    if not goals:
        return "旅行工具: 暂无带地理位置的目标。"
    lines = [f"旅行工具: 用户有 {len(goals)} 个旅行目的地目标"]
    for g in goals[:5]:
        lines.append(f"  - {g.title} @ {g.location or '未知'} (状态: {g.status})")
    return "\n".join(lines)


async def build_growth_context(db: Session, user_id: str) -> str:
    goals = LifeGoalRepository(db).list_by_user(user_id)
    active = [g for g in goals if g.status in ("in_progress", "pending")]
    if not active:
        return "成长工具: 暂无进行中的成长目标。"
    lines = [f"成长工具: {len(active)} 个进行中目标"]
    for g in active[:5]:
        lines.append(f"  - {g.title} (分类: {g.category}, 难度: {g.difficulty})")
    return "\n".join(lines)


async def build_year_context(db: Session, user_id: str) -> str:
    """读取最新年度复盘 (若已生成) 摘要."""
    from app.domains.ai.service import YearSummaryService

    service = YearSummaryService(db)
    latest = service.get_latest(user_id)
    if latest is None:
        return "年度复盘工具: 暂无已生成的年度复盘, 可引导用户先生成。"
    parts = [f"年度复盘工具: {latest.year} 年复盘已生成"]
    if latest.summary:
        parts.append(f"  摘要: {latest.summary}")
    if latest.highlights:
        parts.append("  亮点: " + "、".join(latest.highlights[:4]))
    return "\n".join(parts)


async def build_map_context(db: Session, user_id: str) -> str:
    records = LifeRecordRepository(db).list_geotagged(user_id, limit=100)
    cities = {(r.city, r.country) for r in records if r.city}
    countries = {r.country for r in records if r.country}
    return (
        f"地图工具: 足迹 {len(records)} 条记录, 覆盖 {len(cities)} 个城市, "
        f"{len(countries)} 个国家。"
    )


async def build_friend_context(db: Session, user_id: str) -> str:
    from app.domains.social.repository import FriendRepository

    repo = FriendRepository(db)
    friends = repo.list_friends(user_id)
    return f"好友工具: 当前 {len(friends)} 位好友, 可基于兴趣/目标推荐共同成长伙伴。"


async def build_team_context(db: Session, user_id: str) -> str:
    from sqlalchemy import func

    from app.db.models import GoalMember

    count = (
        db.query(func.count(GoalMember.id))
        .filter(GoalMember.user_id == user_id)
        .scalar()
        or 0
    )
    return f"团队工具: 已加入 {count} 个共同目标, 可为共同目标生成任务分工。"
