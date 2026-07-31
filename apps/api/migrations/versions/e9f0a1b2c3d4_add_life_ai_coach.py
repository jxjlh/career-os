"""add life ai coach (conversations, messages, memory, tasks)

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-08-01 02:00:00.000000

Sprint 9 — Life AI Coach:
- ai_conversations: 多轮对话会话容器 (title/summary/last_message_at).
- coach_messages: 单条消息 (role/content/tool_calls/tokens/provider).  注: 使用 coach_messages 前缀以避免与原职业教练 ai_messages 冲突.
- coach_memory: 长期记忆 (memory_type/content/importance/source).
- coach_tasks: 教练生成的今日行动任务 (status/priority/source/life_goal_id).
"""

import sqlalchemy as sa
from alembic import op

revision = "e9f0a1b2c3d4"
down_revision = "d8e9f0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ai_conversations ──
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])
    op.create_index("ix_ai_conversations_last_message_at", "ai_conversations", ["last_message_at"])

    # ── coach_messages ──
    op.create_table(
        "coach_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls", sa.JSON(), nullable=True),
        sa.Column("tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_conversations.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_coach_messages_conversation_id", "coach_messages", ["conversation_id"])
    op.create_index("ix_coach_messages_created_at", "coach_messages", ["created_at"])

    # ── coach_memory ──
    op.create_table(
        "coach_memory",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("memory_type", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("importance", sa.SmallInteger(), nullable=False, server_default="5"),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="ai"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_coach_memory_user_id", "coach_memory", ["user_id"])
    op.create_index("ix_coach_memory_memory_type", "coach_memory", ["memory_type"])

    # ── coach_tasks ──
    op.create_table(
        "coach_tasks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="coach"),
        sa.Column("life_goal_id", sa.String(length=36), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["life_goal_id"], ["life_goals.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_coach_tasks_user_id", "coach_tasks", ["user_id"])
    op.create_index("ix_coach_tasks_status", "coach_tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_coach_tasks_status", table_name="coach_tasks")
    op.drop_index("ix_coach_tasks_user_id", table_name="coach_tasks")
    op.drop_table("coach_tasks")

    op.drop_index("ix_coach_memory_memory_type", table_name="coach_memory")
    op.drop_index("ix_coach_memory_user_id", table_name="coach_memory")
    op.drop_table("coach_memory")

    op.drop_index("ix_coach_messages_created_at", table_name="coach_messages")
    op.drop_index("ix_coach_messages_conversation_id", table_name="coach_messages")
    op.drop_table("coach_messages")

    op.drop_index("ix_ai_conversations_last_message_at", table_name="ai_conversations")
    op.drop_index("ix_ai_conversations_user_id", table_name="ai_conversations")
    op.drop_table("ai_conversations")
