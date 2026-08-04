import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    current_title: Mapped[str | None] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(120))
    target_title: Mapped[str | None] = mapped_column(String(120))
    target_salary: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    experience_years: Mapped[float | None] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Shanghai")
    language: Mapped[str] = mapped_column(String(16), default="zh-CN")
    weekly_study_minutes: Mapped[int] = mapped_column(Integer, default=420)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_profiles_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True, unique=True)
    nickname: Mapped[str | None] = mapped_column(String(120))
    avatar: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    birth_year: Mapped[int | None] = mapped_column(Integer)
    current_stage: Mapped[str | None] = mapped_column(String(40))
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list)
    interests: Mapped[list[str]] = mapped_column(JSON, default=list)
    career_direction: Mapped[str | None] = mapped_column(String(200))
    life_motto: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_roles_pair"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_pair"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey("permissions.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("user_id", "settings_key", name="uq_settings_user_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    settings_key: Mapped[str] = mapped_column(String(120))
    settings_value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(80))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = ({"sqlite_autoincrement": False},)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    current_level: Mapped[int] = mapped_column(SmallInteger, default=1)
    target_level: Mapped[int] = mapped_column(SmallInteger, default=5)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    url: Mapped[str] = mapped_column(Text, unique=True)
    normalized_url: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    resource_type: Mapped[str] = mapped_column(String(40), index=True)
    source_name: Mapped[str | None] = mapped_column(String(200))
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(16), default="zh")
    difficulty: Mapped[str | None] = mapped_column(String(32))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    author: Mapped[str | None] = mapped_column(String(200))
    license: Mapped[str | None] = mapped_column(String(80))
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    normalized_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserResourceState(Base):
    __tablename__ = "user_resource_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("learning_resources.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="saved")
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class LearningHistory(Base):
    __tablename__ = "learning_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("learning_resources.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String(32), index=True)
    topic: Mapped[str | None] = mapped_column(String(200))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    role: Mapped[str | None] = mapped_column(String(120))
    url: Mapped[str | None] = mapped_column(Text)
    repo_url: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    highlight: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ProjectFile(Base):
    __tablename__ = "project_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    storage_path: Mapped[str] = mapped_column(Text, unique=True)
    original_name: Mapped[str] = mapped_column(String(300))
    file_type: Mapped[str] = mapped_column(String(32), default="other")
    mime_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(120))
    url: Mapped[str | None] = mapped_column(Text)
    salary_min: Mapped[float | None] = mapped_column(Float)
    salary_max: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    jd_raw: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="saved")
    match_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="active")
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    # ── Sprint 10: AI 周计划增强 ──
    weekly_focus: Mapped[str | None] = mapped_column(Text)          # AI 本周寄语
    rationale: Mapped[str | None] = mapped_column(Text)             # AI 为什么这么安排
    tips: Mapped[list] = mapped_column(JSON, default=list)           # AI 建议
    summary: Mapped[str | None] = mapped_column(Text)               # 本周总结
    reflection: Mapped[str | None] = mapped_column(Text)            # 用户反思
    completion_rate: Mapped[float] = mapped_column(Float, default=0)
    total_minutes: Mapped[int] = mapped_column(Integer, default=0)
    completed_minutes: Mapped[int] = mapped_column(Integer, default=0)
    goal_ids: Mapped[list] = mapped_column(JSON, default=list)      # 关联目标 ID
    skill_ids: Mapped[list] = mapped_column(JSON, default=list)    # 关联技能 ID
    context_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_content_id: Mapped[str | None] = mapped_column(ForeignKey("ai_content.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PlanTask(Base):
    __tablename__ = "plan_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    plan_id: Mapped[str] = mapped_column(ForeignKey("weekly_plans.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    day: Mapped[int] = mapped_column(SmallInteger, default=1)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60)
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("learning_resources.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(32), default="todo")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    # ── Sprint 10: AI 周计划增强 ──
    description: Mapped[str | None] = mapped_column(Text)            # AI 生成的"为什么做+怎么做"
    task_type: Mapped[str] = mapped_column(String(24), default="learning")  # learning/practice/project/review/rest
    difficulty: Mapped[str] = mapped_column(String(16), default="medium")   # easy/medium/hard
    priority: Mapped[str] = mapped_column(String(16), default="medium")     # low/medium/high
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    resource_url: Mapped[str | None] = mapped_column(Text)
    estimated_outcome: Mapped[str | None] = mapped_column(String(200))      # 预期产出
    goal_id: Mapped[str | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"), index=True)
    life_goal_id: Mapped[str | None] = mapped_column(ForeignKey("life_goals.id", ondelete="SET NULL"), index=True)
    skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"), index=True)
    milestone_id: Mapped[str | None] = mapped_column(ForeignKey("roadmap_milestones.id", ondelete="SET NULL"), index=True)


class AiChat(Base):
    __tablename__ = "ai_chats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(32), default="coach")
    title: Mapped[str | None] = mapped_column(String(200))
    context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    job_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    error: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    horizon_years: Mapped[int] = mapped_column(SmallInteger, default=5)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    source: Mapped[str] = mapped_column(String(32), default="custom")
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RoadmapMilestone(Base):
    __tablename__ = "roadmap_milestones"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    roadmap_id: Mapped[str] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    phase: Mapped[str | None] = mapped_column(String(80))
    target_date: Mapped[date | None] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="planned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    interview_type: Mapped[str] = mapped_column(String(32), default="mock")
    mode: Mapped[str] = mapped_column(String(32), default="behavioral")
    role: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(16), default="zh-CN")
    difficulty: Mapped[str] = mapped_column(String(32), default="intermediate")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transcript: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    audio_paths: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_provider: Mapped[str | None] = mapped_column(String(64))
    ai_model: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="in_progress")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(32), default="behavioral")
    expected_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    difficulty: Mapped[str | None] = mapped_column(String(32))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str | None] = mapped_column(ForeignKey("interview_questions.id", ondelete="SET NULL"))
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    answer_text: Mapped[str] = mapped_column(Text)
    audio_path: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    overall_score: Mapped[float] = mapped_column(Float, default=0)
    dimensions: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    strengths: Mapped[str | None] = mapped_column(Text)
    improvements: Mapped[str | None] = mapped_column(Text)
    sample_answer: Mapped[str | None] = mapped_column(Text)
    ai_provider: Mapped[str | None] = mapped_column(String(64))
    ai_model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(String(8), default="zh")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    template: Mapped[str] = mapped_column(String(64), default="clean")
    sections: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    change_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SalaryPlan(Base):
    __tablename__ = "salary_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    current_salary: Mapped[float] = mapped_column(Float, default=0)
    target_salary: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    horizon_years: Mapped[int] = mapped_column(Integer, default=3)
    assumptions: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    breakdown: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="generated")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class JobAnalysis(Base):
    __tablename__ = "job_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    extracted_skills: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    required_experience: Mapped[str | None] = mapped_column(Text)
    skill_gaps: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    match_score: Mapped[float] = mapped_column(Float, default=0)
    recommendations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    ai_provider: Mapped[str | None] = mapped_column(String(64))
    ai_model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ProjectAnalysis(Base):
    __tablename__ = "project_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    analysis_type: Mapped[str] = mapped_column(String(32))
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ai_provider: Mapped[str | None] = mapped_column(String(64))
    ai_model: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="succeeded")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    chat_id: Mapped[str] = mapped_column(ForeignKey("ai_chats.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="user")
    content: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    provider: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(64))
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    query: Mapped[str] = mapped_column(String(500))
    raw_query: Mapped[str | None] = mapped_column(Text)
    providers: Mapped[list[str]] = mapped_column(JSON, default=list)
    filters: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_reranked: Mapped[bool] = mapped_column(Boolean, default=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SearchResult(Base):
    __tablename__ = "search_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    query_id: Mapped[str] = mapped_column(ForeignKey("search_queries.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("learning_resources.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(40))
    rank: Mapped[int] = mapped_column(SmallInteger, default=0)
    score: Mapped[float] = mapped_column(Float, default=0)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(Text)
    snippet: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "resource_id", name="uq_bookmarks_user_resource"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("learning_resources.id", ondelete="CASCADE"), index=True)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class BookmarkTag(Base):
    __tablename__ = "bookmark_tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    bookmark_id: Mapped[str] = mapped_column(ForeignKey("bookmarks.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32), default="system")
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    link: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str | None] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class LearningHistoryAggregate(Base):
    __tablename__ = "learning_history_aggregates"
    __table_args__ = (UniqueConstraint("user_id", "month", name="uq_learning_history_aggregates_user_month"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    month: Mapped[date] = mapped_column(Date)
    total_minutes: Mapped[int] = mapped_column(Integer, default=0)
    action_counts: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    resource_completed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class UserLimit(Base):
    __tablename__ = "user_limits"
    __table_args__ = (UniqueConstraint("user_id", "quota_date", name="uq_user_limits_user_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    quota_date: Mapped[date] = mapped_column(Date, default=date.today)
    ai_messages_used: Mapped[int] = mapped_column(Integer, default=0)
    searches_used: Mapped[int] = mapped_column(Integer, default=0)
    ai_summaries_used: Mapped[int] = mapped_column(Integer, default=0)
    quiz_used: Mapped[int] = mapped_column(Integer, default=0)
    interviews_used: Mapped[int] = mapped_column(Integer, default=0)
    resumes_generated: Mapped[int] = mapped_column(Integer, default=0)
    storage_bytes_used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class LimitConfig(Base):
    __tablename__ = "limit_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    config_key: Mapped[str] = mapped_column(String(80), unique=True)
    config_value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class Okr(Base):
    __tablename__ = "okrs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    objective: Mapped[str | None] = mapped_column(Text)
    cycle_start: Mapped[date | None] = mapped_column(Date)
    cycle_end: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="active")
    progress: Mapped[float] = mapped_column(Float, default=0)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class OkrKeyResult(Base):
    __tablename__ = "okr_key_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    okr_id: Mapped[str] = mapped_column(ForeignKey("okrs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    metric_type: Mapped[str] = mapped_column(String(32), default="count")
    target_value: Mapped[float] = mapped_column(Float, default=0)
    current_value: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str | None] = mapped_column(String(32))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="active")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    resource_id: Mapped[str | None] = mapped_column(ForeignKey("learning_resources.id", ondelete="SET NULL"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    topic: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    focus_score: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    vision_type: Mapped[str] = mapped_column(String(40), default="life", index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    why_this_goal: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    ai_generated_plan: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class GoalTask(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    goal_id: Mapped[str | None] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    life_goal_id: Mapped[str | None] = mapped_column(ForeignKey("life_goals.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    task_type: Mapped[str] = mapped_column(String(24), default="phase")
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24), default="todo", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_in_dates: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class LifeGoal(Base):
    __tablename__ = "life_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(40), default="other", index=True)
    description: Mapped[str | None] = mapped_column(Text)
    goal_type: Mapped[str] = mapped_column(String(16), default="manual")
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=3)
    start_date: Mapped[date | None] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(200))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    cover_image: Mapped[str | None] = mapped_column(Text)
    budget: Mapped[str | None] = mapped_column(String(120))
    recommended_days: Mapped[int | None] = mapped_column(Integer)
    best_season: Mapped[str | None] = mapped_column(String(80))
    region: Mapped[str | None] = mapped_column(String(120))
    friends: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_plan_meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class UserLevel(Base):
    __tablename__ = "user_levels"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_levels_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True, unique=True)
    experience: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class LifeRecord(Base):
    __tablename__ = "life_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    goal_id: Mapped[str] = mapped_column(ForeignKey("life_goals.id", ondelete="CASCADE"), index=True)
    record_type: Mapped[str] = mapped_column(String(16), default="photo")
    photo_url: Mapped[str | None] = mapped_column(Text)
    watermark_url: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    city: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(80))
    weather: Mapped[str | None] = mapped_column(String(120))
    altitude: Mapped[float | None] = mapped_column(Float)
    # ── Sprint 7 Life Camera: 视频日志 + AI 场景识别 ──
    video_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    scene_type: Mapped[str | None] = mapped_column(String(40))
    ai_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_description: Mapped[str | None] = mapped_column(Text)
    temperature: Mapped[float | None] = mapped_column(Float)
    bucket_item_id: Mapped[str | None] = mapped_column(
        ForeignKey("bucket_items.id", ondelete="SET NULL"), index=True
    )
    device_info: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class AIContent(Base):
    __tablename__ = "ai_content"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    content_type: Mapped[str] = mapped_column(String(32), index=True)
    input_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    output_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(64))
    task_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class TravelChecklistItem(Base):
    __tablename__ = "travel_checklist_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    ai_content_id: Mapped[str] = mapped_column(ForeignKey("ai_content.id", ondelete="CASCADE"), index=True)
    item: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class BucketCategory(Base):
    __tablename__ = "bucket_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    icon: Mapped[str | None] = mapped_column(String(32))
    color: Mapped[str | None] = mapped_column(String(32))
    cover_image: Mapped[str | None] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class BucketItem(Base):
    __tablename__ = "bucket_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    category_id: Mapped[str] = mapped_column(ForeignKey("bucket_categories.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    story: Mapped[str | None] = mapped_column(Text)
    cover_image: Mapped[str | None] = mapped_column(Text)
    gallery_images: Mapped[list[str]] = mapped_column(JSON, default=list)
    video_url: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(SmallInteger, default=3)
    estimated_cost: Mapped[str | None] = mapped_column(String(80))
    estimated_days: Mapped[int | None] = mapped_column(Integer)
    best_season: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(80), index=True)
    city: Mapped[str | None] = mapped_column(String(120), index=True)
    location: Mapped[str | None] = mapped_column(String(200))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(300))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    tips: Mapped[str | None] = mapped_column(Text)
    ai_prompt: Mapped[str | None] = mapped_column(Text)
    popularity: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="published", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class UserBucketItem(Base):
    __tablename__ = "user_bucket_items"
    __table_args__ = (UniqueConstraint("user_id", "bucket_item_id", name="uq_user_bucket_item"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    bucket_item_id: Mapped[str] = mapped_column(ForeignKey("bucket_items.id", ondelete="CASCADE"), index=True)
    life_goal_id: Mapped[str | None] = mapped_column(ForeignKey("life_goals.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="joined")
    wishlist: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class LifeMapVisit(Base):
    """人生地图访问点: 可显式创建, 也可关联 LifeGoal / LifeRecord / BucketItem.

    地图服务会聚合 visits + 带坐标的 records/goals/bucket 统一渲染.
    """

    __tablename__ = "life_map_visits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    life_goal_id: Mapped[str | None] = mapped_column(ForeignKey("life_goals.id", ondelete="SET NULL"), index=True)
    life_record_id: Mapped[str | None] = mapped_column(ForeignKey("life_records.id", ondelete="SET NULL"), index=True)
    bucket_item_id: Mapped[str | None] = mapped_column(ForeignKey("bucket_items.id", ondelete="SET NULL"), index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    country: Mapped[str | None] = mapped_column(String(80), index=True)
    province: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(120), index=True)
    district: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(300))
    title: Mapped[str | None] = mapped_column(String(200))
    visit_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    photos_count: Mapped[int] = mapped_column(Integer, default=0)
    videos_count: Mapped[int] = mapped_column(Integer, default=0)
    weather: Mapped[str | None] = mapped_column(String(120))
    temperature: Mapped[float | None] = mapped_column(Float)
    cover_image: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(40), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CheckinStreak(Base):
    """连续打卡: 当天首次记录即 +1, 间隔则重置. 跟踪当前/最长/总打卡."""

    __tablename__ = "checkin_streaks"
    __table_args__ = (UniqueConstraint("user_id", name="uq_checkin_streaks_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True, unique=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_checkin_date: Mapped[date | None] = mapped_column(Date)
    total_checkins: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=datetime.utcnow
    )


# ── Sprint 8 Life Social ────────────────────────────────────────────
class Friend(Base):
    """已建立的好友关系. (user_id, friend_id) 唯一; 双向写入两条记录便于双向查询."""

    __tablename__ = "friends"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friends_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    friend_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | blocked
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class FriendRequest(Base):
    """好友申请: from_user → to_user, pending/accepted/rejected."""

    __tablename__ = "friend_requests"
    __table_args__ = (
        UniqueConstraint("from_user", "to_user", name="uq_friend_requests_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    from_user: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    to_user: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending/accepted/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SharedGoal(Base):
    """共同目标: 将一个 Life Goal 共享给好友, 协作完成 (一起旅行/读书/跑步/考研)."""

    __tablename__ = "shared_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    life_goal_id: Mapped[str] = mapped_column(
        ForeignKey("life_goals.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    visibility: Mapped[str] = mapped_column(String(16), default="friends")  # public/friends/private/link
    share_code: Mapped[str | None] = mapped_column(String(32), index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class GoalMember(Base):
    """共同目标成员: 每个加入的用户及其角色 (owner/member)."""

    __tablename__ = "goal_members"
    __table_args__ = (
        UniqueConstraint("shared_goal_id", "user_id", name="uq_goal_members_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    shared_goal_id: Mapped[str] = mapped_column(
        ForeignKey("shared_goals.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # owner/member
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SocialPost(Base):
    """人生动态: 可关联 LifeRecord/BucketItem, 含图片/视频/文字/定位, 带可见性."""

    __tablename__ = "social_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    life_record_id: Mapped[str | None] = mapped_column(
        ForeignKey("life_records.id", ondelete="SET NULL"), index=True
    )
    bucket_item_id: Mapped[str | None] = mapped_column(
        ForeignKey("bucket_items.id", ondelete="SET NULL"), index=True
    )
    content: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[list[str]] = mapped_column(JSON, default=list)
    videos: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(16), default="friends")  # public/friends/private/link
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class Like(Base):
    """点赞: (user_id, post_id) 唯一, 重复点赞幂等 (toggle)."""

    __tablename__ = "likes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_likes_user_post"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("social_posts.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Comment(Base):
    """评论: 对动态的回复."""

    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("social_posts.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


# ── Sprint 9 Life AI Coach ──────────────────────────────────────────
class AIConversation(Base):
    """AI 教练对话会话: 多轮对话的容器, 聚合消息与摘要."""

    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(Text)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class AIMessage(Base):
    """AI 教练单条消息: user / assistant / system 角色, 可携带工具调用记录.

    注: 表名使用 ``coach_messages`` 以避免与原职业教练模块 ``AiMessage`` (表 ``ai_messages``) 冲突.
    """

    __tablename__ = "coach_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant | system
    content: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    provider: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class CoachMemory(Base):
    """AI 教练长期记忆: 从对话与行为中提取的用户画像, 持续更新."""

    __tablename__ = "coach_memory"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    memory_type: Mapped[str] = mapped_column(String(40), index=True)  # goal/interest/travel/learning/career/language/budget
    content: Mapped[str] = mapped_column(Text)
    importance: Mapped[int] = mapped_column(SmallInteger, default=5)  # 1~10
    source: Mapped[str] = mapped_column(String(40), default="ai")  # ai | user | system
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class CoachTask(Base):
    """AI 教练生成的任务: 今日行动建议的具体落地, 可关联人生目标."""

    __tablename__ = "coach_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="todo", index=True)  # todo | done | postponed
    priority: Mapped[str] = mapped_column(String(16), default="medium")  # low | medium | high
    source: Mapped[str] = mapped_column(String(40), default="coach")  # coach | advice | review
    life_goal_id: Mapped[str | None] = mapped_column(
        ForeignKey("life_goals.id", ondelete="SET NULL"), index=True
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# ── Sprint 12 好友聊天与群组 ─────────────────────────────────────
class ChatConversation(Base):
    """聊天会话: 私聊 (direct) 和群聊 (group). 私聊会话两人共享一个会话ID."""

    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_type: Mapped[str] = mapped_column(String(16), default="direct", index=True)  # direct | group
    name: Mapped[str | None] = mapped_column(String(120))  # 群聊名称
    avatar_url: Mapped[str | None] = mapped_column(Text)  # 群聊头像
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id", ondelete="SET NULL"), index=True)  # 群主
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_message_preview: Mapped[str | None] = mapped_column(String(500))  # 最后一条消息预览
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)


class ConversationMember(Base):
    """会话成员: 私聊两人, 群聊多人. 用于查询用户的所有会话."""

    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_members_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # owner | admin | member
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 最后已读时间
    muted: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否静音
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ChatMessage(Base):
    """聊天消息: 支持文本、图片、系统消息. 图片存储路径可下载."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="SET NULL"), index=True)
    message_type: Mapped[str] = mapped_column(String(16), default="text", index=True)  # text | image | system
    content: Mapped[str | None] = mapped_column(Text)  # 文本内容或图片URL
    # 图片相关
    image_url: Mapped[str | None] = mapped_column(Text)  # 图片URL (Supabase Storage)
    image_width: Mapped[int | None] = mapped_column(Integer)
    image_height: Mapped[int | None] = mapped_column(Integer)
    # 系统消息类型
    system_action: Mapped[str | None] = mapped_column(String(40))  # added_member | removed_member | renamed | ...
    system_meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    # 引用回复
    reply_to_id: Mapped[str | None] = mapped_column(ForeignKey("chat_messages.id", ondelete="SET NULL"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 软删除
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class MessageRead(Base):
    """消息已读状态: 记录每条消息的已读用户, 用于显示"已读"状态."""

    __tablename__ = "message_reads"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_reads_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    message_id: Mapped[str] = mapped_column(ForeignKey("chat_messages.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# ── Sprint 11 Daily Journal ────────────────────────────────────────
class DailyJournal(Base):
    """每日小记: 记录当天心情 + 内容, 可关联目标/技能. 一人一天一条."""

    __tablename__ = "daily_journals"
    __table_args__ = (UniqueConstraint("user_id", "journal_date", name="uq_daily_journal_user_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    journal_date: Mapped[date] = mapped_column(Date, index=True)
    # 心情: emoji 序号 0-4, 对应 😵😐🙂😎✨
    mood_index: Mapped[int] = mapped_column(SmallInteger)
    content: Mapped[str | None] = mapped_column(Text)
    # 标签, 如 ["工作", "学习", "生活"]
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    goal_id: Mapped[str | None] = mapped_column(
        ForeignKey("life_goals.id", ondelete="SET NULL"), index=True
    )
    skill_id: Mapped[str | None] = mapped_column(
        ForeignKey("skills.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)
