from app.core.repository import BaseRepository
from app.db.models import Skill, UserSkill

SEED_SKILLS = [
    ("Marketing", "Marketing", "品牌与营销基础"),
    ("Growth", "Growth Marketing", "增长营销与 A/B 测试"),
    ("Data", "SQL", "数据分析查询"),
    ("Data", "Power BI", "数据可视化"),
    ("Data", "Python", "数据处理与自动化"),
    ("Data", "GA4", "网站数据分析"),
    ("AI", "AI Agent", "智能体应用开发"),
    ("Marketing", "Product Marketing", "产品上市与定位"),
    ("Ops", "Marketing Ops", "营销运营与自动化"),
    ("CRM", "HubSpot", "CRM 管理与自动化"),
    ("Engineering", "System Design", "系统设计"),
    ("Product", "Product Planning", "产品规划"),
]


class SkillRepository(BaseRepository[Skill]):
    def __init__(self, db):
        super().__init__(db, Skill)

    def seed_defaults(self) -> None:
        for category, name, description in SEED_SKILLS:
            if self.db.query(Skill).filter(Skill.name == name).first() is None:
                self.db.add(Skill(name=name, category=category, description=description))
        self.db.commit()

    def list_ordered(self) -> list[Skill]:
        return self.db.query(Skill).order_by(Skill.category, Skill.name).all()


class UserSkillRepository(BaseRepository[UserSkill]):
    def __init__(self, db):
        super().__init__(db, UserSkill)

    def list_by_user(self, user_id: str) -> dict[str, UserSkill]:
        rows = self.db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
        return {row.skill_id: row for row in rows}

    def upsert(self, user_id: str, skill_id: str, current: int, target: int, confidence: float, notes: str | None) -> UserSkill:
        row = (
            self.db.query(UserSkill)
            .filter(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
            .first()
        )
        if row is None:
            row = UserSkill(user_id=user_id, skill_id=skill_id)
            self.db.add(row)
        row.current_level = current
        row.target_level = target
        row.confidence = confidence
        row.notes = notes
        return row
