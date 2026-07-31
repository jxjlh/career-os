from app.core.repository import BaseRepository
from app.db.models import Goal, GoalTask


class GoalRepository(BaseRepository[Goal]):
    def __init__(self, db):
        super().__init__(db, Goal)

    def list_by_user(self, user_id: str) -> list[Goal]:
        return self.db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()

    def get_owned(self, user_id: str, goal_id: str) -> Goal | None:
        return self.db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()

    def create(self, user_id: str, **values) -> Goal:
        goal = Goal(user_id=user_id, **values)
        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal


class TaskRepository(BaseRepository[GoalTask]):
    def __init__(self, db):
        super().__init__(db, GoalTask)

    def list_by_goal(self, goal_id: str) -> list[GoalTask]:
        return (
            self.db.query(GoalTask)
            .filter(GoalTask.goal_id == goal_id)
            .order_by(GoalTask.created_at)
            .all()
        )

    def list_by_life_goal(self, life_goal_id: str) -> list[GoalTask]:
        # AI 成长规划生成的任务挂在 life_goal_id 上(goal_id 为空), 按到期日升序, 未排期的按创建顺序
        return (
            self.db.query(GoalTask)
            .filter(GoalTask.life_goal_id == life_goal_id)
            .order_by(GoalTask.due_date.asc(), GoalTask.created_at)
            .all()
        )

    def get_owned(self, user_id: str, task_id: str) -> GoalTask | None:
        return self.db.query(GoalTask).filter(GoalTask.id == task_id, GoalTask.user_id == user_id).first()

    def create(self, user_id: str, goal_id: str, **values) -> GoalTask:
        task = GoalTask(user_id=user_id, goal_id=goal_id, **values)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
