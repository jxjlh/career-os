from datetime import date, datetime

from sqlalchemy.orm import Session

from app.db.models import Goal, GoalTask
from app.domains.goals.repository import GoalRepository, TaskRepository
from app.domains.goals.schemas import GoalCreate, GoalUpdate, TaskCreate, TaskUpdate


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def goal_dict(goal: Goal, tasks: list[GoalTask] | None = None) -> dict:
    return {
        "id": goal.id,
        "title": goal.title,
        "visionType": goal.vision_type,
        "category": goal.category,
        "description": goal.description,
        "whyThisGoal": goal.why_this_goal,
        "priority": goal.priority,
        "startDate": goal.start_date.isoformat() if goal.start_date else None,
        "dueDate": goal.due_date.isoformat() if goal.due_date else None,
        "status": goal.status,
        "progress": goal.progress,
        "aiGeneratedPlan": goal.ai_generated_plan or {},
        "createdAt": goal.created_at.isoformat() if goal.created_at else None,
        "updatedAt": goal.updated_at.isoformat() if goal.updated_at else None,
        "taskCount": len(tasks) if tasks is not None else None,
    }


def task_dict(task: GoalTask) -> dict:
    return {
        "id": task.id,
        "goalId": task.goal_id,
        "title": task.title,
        "description": task.description,
        "taskType": task.task_type,
        "dueDate": task.due_date.isoformat() if task.due_date else None,
        "status": task.status,
        "completedAt": task.completed_at.isoformat() if task.completed_at else None,
        "checkInDates": task.check_in_dates or [],
        "createdAt": task.created_at.isoformat() if task.created_at else None,
        "updatedAt": task.updated_at.isoformat() if task.updated_at else None,
    }


class GoalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = GoalRepository(db)
        self.tasks = TaskRepository(db)

    def calculate_progress(self, goal: Goal) -> int:
        task_list = self.tasks.list_by_goal(goal.id)
        if not task_list:
            return goal.progress
        done = sum(1 for task in task_list if task.status == "done")
        return round(done * 100 / len(task_list))

    def refresh_progress(self, goal: Goal) -> None:
        goal.progress = self.calculate_progress(goal)
        if goal.status == "completed":
            goal.progress = 100
        self.db.commit()
        self.db.refresh(goal)

    def list(self, user_id: str) -> list[dict]:
        return [goal_dict(goal, self.tasks.list_by_goal(goal.id)) for goal in self.repository.list_by_user(user_id)]

    def get(self, user_id: str, goal_id: str) -> Goal | None:
        return self.repository.get_owned(user_id, goal_id)

    def detail(self, user_id: str, goal_id: str) -> dict | None:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return None
        return goal_dict(goal, self.tasks.list_by_goal(goal.id))

    def create(self, user_id: str, payload: GoalCreate) -> Goal:
        data = payload.model_dump()
        data["vision_type"] = data.pop("visionType")
        data["why_this_goal"] = data.pop("whyThisGoal", None)
        data["start_date"] = parse_date(data.pop("startDate", None))
        data["due_date"] = parse_date(data.pop("dueDate", None))
        goal = self.repository.create(user_id, **data)
        self.refresh_progress(goal)
        return goal

    def update(self, user_id: str, goal_id: str, payload: GoalUpdate) -> Goal | None:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        if "startDate" in data:
            goal.start_date = parse_date(data.pop("startDate"))
        if "dueDate" in data:
            goal.due_date = parse_date(data.pop("dueDate"))
        if "visionType" in data:
            goal.vision_type = data.pop("visionType")
        if "whyThisGoal" in data:
            goal.why_this_goal = data.pop("whyThisGoal")
        for field, value in data.items():
            if value is not None:
                setattr(goal, field, value)
        self.db.commit()
        self.refresh_progress(goal)
        return goal

    def complete(self, user_id: str, goal_id: str) -> Goal | None:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return None
        goal.status = "completed"
        goal.progress = 100
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def delete(self, user_id: str, goal_id: str) -> bool:
        goal = self.repository.get_owned(user_id, goal_id)
        if goal is None:
            return False
        self.db.delete(goal)
        self.db.commit()
        return True


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = TaskRepository(db)
        self.goals = GoalRepository(db)

    def list(self, user_id: str, goal_id: str) -> list[dict]:
        goal = self.goals.get_owned(user_id, goal_id)
        if goal is None:
            return []
        return [task_dict(task) for task in self.repository.list_by_goal(goal.id)]

    def create(self, user_id: str, goal_id: str, payload: TaskCreate) -> GoalTask | None:
        goal = self.goals.get_owned(user_id, goal_id)
        if goal is None:
            return None
        data = payload.model_dump()
        data["task_type"] = data.pop("taskType")
        data["due_date"] = parse_date(data.pop("dueDate", None))
        task = self.repository.create(user_id, goal.id, **data)
        return task

    def update(self, user_id: str, task_id: str, payload: TaskUpdate) -> GoalTask | None:
        task = self.repository.get_owned(user_id, task_id)
        if task is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        if "dueDate" in data:
            task.due_date = parse_date(data.pop("dueDate"))
        if "taskType" in data:
            task.task_type = data.pop("taskType")
        if "checkInDates" in data:
            task.check_in_dates = data.pop("checkInDates") or []
        if "status" in data and data["status"] == "done":
            task.status = "done"
            task.completed_at = datetime.utcnow()
            if date.today().isoformat() not in (task.check_in_dates or []):
                task.check_in_dates = (task.check_in_dates or []) + [date.today().isoformat()]
            data.pop("status")
        for field, value in data.items():
            if value is not None:
                setattr(task, field, value)
        self.db.commit()
        self.db.refresh(task)
        goal = self.goals.get(task.goal_id)
        if goal:
            GoalService(self.db).refresh_progress(goal)
        return task

    def complete(self, user_id: str, task_id: str) -> GoalTask | None:
        return self.update(
            user_id,
            task_id,
            TaskUpdate.model_validate({"status": "done"}),
        )

    def delete(self, user_id: str, task_id: str) -> bool:
        task = self.repository.get_owned(user_id, task_id)
        if task is None:
            return False
        self.db.delete(task)
        self.db.commit()
        return True
