from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import PlanTask, Profile, Skill, UserSkill, WeeklyPlan
from app.domains.skills.repository import SkillRepository, UserSkillRepository


def skill_dict(skill: Skill, user_skill: UserSkill | None) -> dict:
    current_level = user_skill.current_level if user_skill else 0
    target_level = user_skill.target_level if user_skill else 0
    return {
        "skillId": skill.id,
        "name": skill.name,
        "category": skill.category,
        "description": skill.description,
        "icon": skill.icon,
        "currentLevel": current_level,
        "targetLevel": target_level,
        "gap": (target_level - current_level) if user_skill else 0,
        "masteryPercent": round(min(100, max(0, current_level * 10)), 1),
        "targetProgressPercent": round(min(100, max(0, current_level * 100 / target_level)), 1) if target_level else 0,
        "learningStatus": user_skill.learning_status if user_skill else "learning",
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
        learning_status: str | None = None,
    ) -> dict:
        skill = self.skills.get(skill_id)
        if skill is None:
            raise KeyError(skill_id)
        row = self.user_skills.upsert(profile.id, skill_id, current, target, confidence, notes, learning_status)
        self.user_skills.commit()
        self.db.refresh(row)
        return skill_dict(skill, row)

    def detail(self, profile: Profile, skill_id: str) -> dict:
        skill = self.skills.get(skill_id)
        if skill is None:
            raise KeyError(skill_id)
        user_skill = self.user_skills.get_by_user_and_skill(profile.id, skill_id)
        week_start = date.today() - timedelta(days=date.today().weekday())
        tasks = (
            self.db.query(PlanTask)
            .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
            .filter(
                WeeklyPlan.user_id == profile.id,
                WeeklyPlan.week_start == week_start,
                PlanTask.skill_id == skill_id,
            )
            .order_by(PlanTask.day, PlanTask.sort_order)
            .all()
        )
        total_minutes = sum(task.estimated_minutes for task in tasks)
        completed_minutes = sum(task.estimated_minutes for task in tasks if task.status == "done")
        current_level = user_skill.current_level if user_skill else 0
        target_level = user_skill.target_level if user_skill else 5
        return {
            "skill": skill_dict(skill, user_skill),
            "knowledgePoints": [],
            "assessment": None,
            "planStats": {
                "weekStart": week_start.isoformat(),
                "total": len(tasks),
                "done": sum(1 for task in tasks if task.status == "done"),
                "completionRate": round((sum(1 for task in tasks if task.status == "done") / len(tasks)) * 100, 1) if tasks else 0,
                "totalMinutes": total_minutes,
                "completedMinutes": completed_minutes,
            },
            "progress": [{"label": date.today().isoformat(), "currentLevel": current_level, "targetLevel": target_level}],
            "tasks": [
                {
                    "id": task.id,
                    "title": task.title,
                    "day": task.day,
                    "status": task.status,
                    "estimatedMinutes": task.estimated_minutes,
                    "notes": task.notes,
                }
                for task in tasks
            ],
        }
