"""add life social (friends/requests/shared_goals/members/posts/likes/comments)

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-08-01 00:00:00.000000

Sprint 8 — Life Social:
- friends: 好友关系 (双向).
- friend_requests: 好友申请.
- shared_goals + goal_members: 共同目标协作.
- social_posts + likes + comments: 人生动态 Feed.
"""

import sqlalchemy as sa
from alembic import op

revision = "d8e9f0a1b2c3"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friends",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("friend_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friends_pair"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["friend_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_friends_user_id", "friends", ["user_id"])
    op.create_index("ix_friends_friend_id", "friends", ["friend_id"])

    op.create_table(
        "friend_requests",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("from_user", sa.String(length=36), nullable=False),
        sa.Column("to_user", sa.String(length=36), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("from_user", "to_user", name="uq_friend_requests_pair"),
        sa.ForeignKeyConstraint(["from_user"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_user"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_friend_requests_from_user", "friend_requests", ["from_user"])
    op.create_index("ix_friend_requests_to_user", "friend_requests", ["to_user"])
    op.create_index("ix_friend_requests_status", "friend_requests", ["status"])

    op.create_table(
        "shared_goals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("life_goal_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="friends"),
        sa.Column("share_code", sa.String(length=32), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["life_goal_id"], ["life_goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_shared_goals_life_goal_id", "shared_goals", ["life_goal_id"])
    op.create_index("ix_shared_goals_owner_id", "shared_goals", ["owner_id"])
    op.create_index("ix_shared_goals_share_code", "shared_goals", ["share_code"])

    op.create_table(
        "goal_members",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shared_goal_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shared_goal_id", "user_id", name="uq_goal_members_pair"),
        sa.ForeignKeyConstraint(["shared_goal_id"], ["shared_goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_goal_members_shared_goal_id", "goal_members", ["shared_goal_id"])
    op.create_index("ix_goal_members_user_id", "goal_members", ["user_id"])

    op.create_table(
        "social_posts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("life_record_id", sa.String(length=36), nullable=True),
        sa.Column("bucket_item_id", sa.String(length=36), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("photos", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("videos", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="friends"),
        sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["life_record_id"], ["life_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["bucket_item_id"], ["bucket_items.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_social_posts_user_id", "social_posts", ["user_id"])
    op.create_index("ix_social_posts_created_at", "social_posts", ["created_at"])
    op.create_index("ix_social_posts_life_record_id", "social_posts", ["life_record_id"])
    op.create_index("ix_social_posts_bucket_item_id", "social_posts", ["bucket_item_id"])

    op.create_table(
        "likes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("post_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "post_id", name="uq_likes_user_post"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_likes_user_id", "likes", ["user_id"])
    op.create_index("ix_likes_post_id", "likes", ["post_id"])

    op.create_table(
        "comments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("post_id", sa.String(length=36), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_comments_user_id", "comments", ["user_id"])
    op.create_index("ix_comments_post_id", "comments", ["post_id"])
    op.create_index("ix_comments_created_at", "comments", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_comments_created_at", table_name="comments")
    op.drop_index("ix_comments_post_id", table_name="comments")
    op.drop_index("ix_comments_user_id", table_name="comments")
    op.drop_table("comments")

    op.drop_index("ix_likes_post_id", table_name="likes")
    op.drop_index("ix_likes_user_id", table_name="likes")
    op.drop_table("likes")

    op.drop_index("ix_social_posts_bucket_item_id", table_name="social_posts")
    op.drop_index("ix_social_posts_life_record_id", table_name="social_posts")
    op.drop_index("ix_social_posts_created_at", table_name="social_posts")
    op.drop_index("ix_social_posts_user_id", table_name="social_posts")
    op.drop_table("social_posts")

    op.drop_index("ix_goal_members_user_id", table_name="goal_members")
    op.drop_index("ix_goal_members_shared_goal_id", table_name="goal_members")
    op.drop_table("goal_members")

    op.drop_index("ix_shared_goals_share_code", table_name="shared_goals")
    op.drop_index("ix_shared_goals_owner_id", table_name="shared_goals")
    op.drop_index("ix_shared_goals_life_goal_id", table_name="shared_goals")
    op.drop_table("shared_goals")

    op.drop_index("ix_friend_requests_status", table_name="friend_requests")
    op.drop_index("ix_friend_requests_to_user", table_name="friend_requests")
    op.drop_index("ix_friend_requests_from_user", table_name="friend_requests")
    op.drop_table("friend_requests")

    op.drop_index("ix_friends_friend_id", table_name="friends")
    op.drop_index("ix_friends_user_id", table_name="friends")
    op.drop_table("friends")
