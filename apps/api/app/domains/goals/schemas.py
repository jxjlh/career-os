from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

VisionType = Literal["life", "career", "skill", "health", "finance", "relationship", "travel"]
Priority = Literal["low", "medium", "high"]
GoalStatus = Literal["draft", "active", "completed", "archived"]
TaskType = Literal["daily", "weekly", "phase"]
TaskStatus = Literal["todo", "done", "skipped"]


class GoalCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str = Field(min_length=1, max_length=200)
    visionType: VisionType = "life"
    category: str | None = Field(default=None, max_length=80)
    description: str | None = None
    whyThisGoal: str | None = None
    priority: Priority = "medium"
    startDate: str | None = None
    dueDate: str | None = None
    status: GoalStatus = "draft"


class GoalUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    visionType: VisionType | None = None
    category: str | None = Field(default=None, max_length=80)
    description: str | None = None
    whyThisGoal: str | None = None
    priority: Priority | None = None
    startDate: str | None = None
    dueDate: str | None = None
    status: GoalStatus | None = None


class TaskCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    taskType: TaskType = "phase"
    dueDate: str | None = None
    status: TaskStatus = "todo"


class TaskUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    taskType: TaskType | None = None
    dueDate: str | None = None
    status: TaskStatus | None = None
    checkInDates: list[str] | None = None
