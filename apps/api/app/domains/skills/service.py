from sqlalchemy.orm import Session

from app.core.timeutil import today, week_start

from app.db.models import DailyReview, PlanTask, Profile, Skill, UserSkill, WeeklyPlan
from app.domains.skills.repository import SkillRepository, UserSkillRepository

# 掌握度换算基准：每提升 1 个等级约需 300 分钟有效学习（确定性常量，不调 AI）
MINUTES_PER_LEVEL = 300


def _empty_evidence() -> dict:
    return {
        "totalTasks": 0,
        "doneTasks": 0,
        "plannedMinutes": 0,
        "doneMinutes": 0,
        "taskRate": 0.0,
        "minuteRate": 0.0,
        "hasEvidence": False,
    }


def compute_mastery(evidence: dict, target_level: int) -> float:
    """由真实学习证据算掌握度(0-100)。纯确定性，不调 AI。

    公式: 60% 任务完成率 + 40% 学习时长达成率（相对 target_level * 300 分钟）。
    没有任何学习任务 → 0，绝不拿自评等级冒充真实进度。
    """
    if not evidence.get("hasEvidence"):
        return 0.0
    goal_minutes = max(int(target_level or 1), 1) * MINUTES_PER_LEVEL
    task_rate = evidence["taskRate"]
    minute_rate = min(1.0, evidence["doneMinutes"] / goal_minutes) if goal_minutes else 0.0
    evidence["minuteRate"] = round(minute_rate, 4)
    evidence["goalMinutes"] = goal_minutes
    return round(100 * (0.6 * task_rate + 0.4 * minute_rate), 1)


def compute_effective_mastery(
    evidence: dict,
    target_level: int,
    current_level: int,
    learning_status: str,
) -> tuple[float, str]:
    """综合掌握度（按数据来源优先级）。

    返回 (mastery_percent, mastery_source)，source 取值:
      - "evidence"       有真实学习任务记录 → 用 compute_mastery 算
      - "self_assessed"  无记录但标记"已掌握"(mastered) → 用自评等级×10（标注待验证）
      - "none"           "学习中"且无记录 → 0%（引导去周计划）

    这样老板把技能从「想学」移到「已经会」后，掌握度不再是 0%，
    而是反映他的自评；做了周计划任务并标记完成后，以真实数据覆盖自评。
    """
    if evidence.get("hasEvidence"):
        return compute_mastery(dict(evidence), target_level or 10), "evidence"
    if learning_status == "mastered":
        self_assessed = round(min(100, max(0, (current_level or 0) * 10)), 1)
        return self_assessed, "self_assessed"
    return 0.0, "none"


def build_evidence(db: Session, user_id: str, skill_id: str) -> dict:
    """统计某个技能下的真实学习证据（周计划任务完成情况）。"""
    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.user_id == user_id, PlanTask.skill_id == skill_id)
        .all()
    )
    evidence = _empty_evidence()
    if not tasks:
        return evidence
    done = [t for t in tasks if t.status == "done"]
    evidence.update(
        {
            "totalTasks": len(tasks),
            "doneTasks": len(done),
            "plannedMinutes": sum(t.estimated_minutes or 0 for t in tasks),
            "doneMinutes": sum(t.estimated_minutes or 0 for t in done),
            "taskRate": round(len(done) / len(tasks), 4),
            "hasEvidence": True,
        }
    )
    return evidence


def build_evidence_map(db: Session, user_id: str) -> dict[str, dict]:
    """一次性聚合所有技能的证据，避免 N+1 查询。"""
    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.user_id == user_id, PlanTask.skill_id.isnot(None))
        .all()
    )
    aggregated: dict[str, dict] = {}
    for task in tasks:
        bucket = aggregated.setdefault(task.skill_id, _empty_evidence())
        bucket["totalTasks"] += 1
        bucket["plannedMinutes"] += task.estimated_minutes or 0
        if task.status == "done":
            bucket["doneTasks"] += 1
            bucket["doneMinutes"] += task.estimated_minutes or 0
    for bucket in aggregated.values():
        if bucket["totalTasks"]:
            bucket["taskRate"] = round(bucket["doneTasks"] / bucket["totalTasks"], 4)
            bucket["hasEvidence"] = True
    return aggregated


def skill_dict(skill: Skill, user_skill: UserSkill | None, evidence: dict | None = None) -> dict:
    current_level = user_skill.current_level if user_skill else 0
    target_level = user_skill.target_level if user_skill else 0
    learning_status = user_skill.learning_status if user_skill else "learning"
    evidence = evidence or _empty_evidence()
    mastery, mastery_source = compute_effective_mastery(
        dict(evidence), target_level or 10, current_level, learning_status
    )
    return {
        "skillId": skill.id,
        "name": skill.name,
        "category": skill.category,
        "description": skill.description,
        "icon": skill.icon,
        "currentLevel": current_level,
        "targetLevel": target_level,
        "gap": (target_level - current_level) if user_skill else 0,
        # 综合掌握度：有学习任务用真实数据；无记录但"已掌握"用自评；"学习中"无记录为 0
        "masteryPercent": mastery,
        "masterySource": mastery_source,  # evidence | self_assessed | none
        "evidence": {
            "hasEvidence": evidence.get("hasEvidence", False),
            "totalTasks": evidence.get("totalTasks", 0),
            "doneTasks": evidence.get("doneTasks", 0),
            "plannedMinutes": evidence.get("plannedMinutes", 0),
            "doneMinutes": evidence.get("doneMinutes", 0),
            "goalMinutes": max(int(target_level or 1), 1) * MINUTES_PER_LEVEL,
        },
        # 自评等级只作为参考基线单独返回，不再用来冒充掌握度
        "selfAssessedPercent": round(min(100, max(0, current_level * 10)), 1),
        "targetProgressPercent": round(min(100, max(0, current_level * 100 / target_level)), 1) if target_level else 0,
        "learningStatus": learning_status,
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
        all_skills = {s.id: s for s in self.skills.list_ordered()}
        evidence_map = build_evidence_map(self.db, profile.id)
        return [
            skill_dict(all_skills[skill_id], row, evidence_map.get(skill_id))
            for skill_id, row in user_rows.items()
            if skill_id in all_skills
        ]

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
        return skill_dict(skill, row, build_evidence(self.db, profile.id, skill_id))

    def detail(self, profile: Profile, skill_id: str) -> dict:
        skill = self.skills.get(skill_id)
        if skill is None:
            raise KeyError(skill_id)
        user_skill = self.user_skills.get_by_user_and_skill(profile.id, skill_id)
        current_week_start = week_start()
        tasks = (
            self.db.query(PlanTask)
            .join(WeeklyPlan, WeeklyPlan.id == PlanTask.plan_id)
            .filter(
                WeeklyPlan.user_id == profile.id,
                WeeklyPlan.week_start == current_week_start,
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
            # evidence 用「全部历史任务」，掌握度看的是累计学习进度，不只是本周
            "skill": skill_dict(skill, user_skill, build_evidence(self.db, profile.id, skill_id)),
            "knowledgePoints": [],
            "assessment": None,
            "planStats": {
                "weekStart": current_week_start.isoformat(),
                "total": len(tasks),
                "done": sum(1 for task in tasks if task.status == "done"),
                "completionRate": round((sum(1 for task in tasks if task.status == "done") / len(tasks)) * 100, 1) if tasks else 0,
                "totalMinutes": total_minutes,
                "completedMinutes": completed_minutes,
            },
            "progress": [{"label": today().isoformat(), "currentLevel": current_level, "targetLevel": target_level}],
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
