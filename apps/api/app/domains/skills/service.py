from sqlalchemy.orm import Session

from app.db.models import Profile, Skill, UserSkill
from app.domains.skills.repository import SkillRepository, UserSkillRepository


def skill_dict(skill: Skill, user_skill: UserSkill | None) -> dict:
    return {
        "skillId": skill.id,
        "name": skill.name,
        "category": skill.category,
        "description": skill.description,
        "icon": skill.icon,
        "currentLevel": user_skill.current_level if user_skill else 0,
        "targetLevel": user_skill.target_level if user_skill else 0,
        "gap": (user_skill.target_level - user_skill.current_level) if user_skill else 0,
        "confidence": user_skill.confidence if user_skill else 0,
        "notes": user_skill.notes if user_skill else None,
    }


class SkillService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.skills = SkillRepository(db)
        self.user_skills = UserSkillRepository(db)

    def catalog(self) -> list[dict]:
        self.skills.seed_defaults()
        return [skill_dict(skill, None) for skill in self.skills.list_ordered()]

    def matrix(self, profile: Profile) -> list[dict]:
        self.skills.seed_defaults()
        user_rows = self.user_skills.list_by_user(profile.id)
        return [skill_dict(skill, user_rows.get(skill.id)) for skill in self.skills.list_ordered()]

    def update_progress(
        self,
        profile: Profile,
        skill_id: str,
        current: int,
        target: int,
        confidence: float,
        notes: str | None,
    ) -> dict:
        skill = self.skills.get(skill_id)
        if skill is None:
            raise KeyError(skill_id)
        row = self.user_skills.upsert(profile.id, skill_id, current, target, confidence, notes)
        self.user_skills.commit()
        self.db.refresh(row)
        return skill_dict(skill, row)
