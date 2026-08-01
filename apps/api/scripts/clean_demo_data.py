"""清理本地/演示数据库中的用户测试数据, 保留系统目录与账号本身.

保留: profiles, skills, bucket_categories, bucket_items, learning_resources,
settings, roles, permissions, audit_logs, background_jobs.
删除: 所有用户创建的内容 (目标/记录/项目/攻略/聊天/计划等).
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "career_os.db"

USER_TABLES = [
    "travel_checklist_items",
    "ai_messages",
    "ai_conversations",
    "ai_chats",
    "ai_content",
    "bookmark_tags",
    "bookmarks",
    "checkin_streaks",
    "coach_memory",
    "coach_messages",
    "coach_tasks",
    "comments",
    "friend_requests",
    "friends",
    "goal_members",
    "goals",
    "interview_answers",
    "interview_feedback",
    "interview_questions",
    "interview_sessions",
    "interviews",
    "job_analyses",
    "jobs",
    "learning_history",
    "learning_history_aggregates",
    "life_goals",
    "life_map_visits",
    "life_records",
    "likes",
    "notifications",
    "okr_key_results",
    "okrs",
    "plan_tasks",
    "project_analyses",
    "project_files",
    "projects",
    "resume_versions",
    "resumes",
    "roadmap_milestones",
    "roadmaps",
    "salary_plans",
    "search_queries",
    "search_results",
    "shared_goals",
    "social_posts",
    "study_sessions",
    "tags",
    "tasks",
    "user_bucket_items",
    "user_levels",
    "user_limits",
    "user_profiles",
    "user_resource_states",
    "user_skills",
    "weekly_plans",
]


def main() -> None:
    if not DB_PATH.exists():
        print(f"数据库不存在: {DB_PATH}")
        return
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")
    total = 0
    for table in USER_TABLES:
        try:
            cursor = conn.execute(f"DELETE FROM {table}")
            count = cursor.rowcount
            if count:
                total += count
                print(f"cleared {table}: {count} rows")
        except sqlite3.OperationalError as exc:
            print(f"skip {table}: {exc}")
    conn.commit()
    conn.close()
    print(f"done. removed {total} rows of user data.")


if __name__ == "__main__":
    main()
