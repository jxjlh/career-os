"""修复 daily_journals 表的唯一约束。

在 Render PostgreSQL 上执行:
    python scripts/fix_journal_constraint.py

或者直接在 psql 中执行:
    ALTER TABLE daily_journals DROP CONSTRAINT IF EXISTS uq_daily_journal_user_date;
    DELETE FROM daily_journals WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, journal_date, time_slot ORDER BY created_at DESC) as rn
            FROM daily_journals
        ) ranked WHERE rn > 1
    );
    ALTER TABLE daily_journals ADD CONSTRAINT uq_daily_journal_user_date_slot UNIQUE (user_id, journal_date, time_slot);
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    # 解析 URL
    url = make_url(database_url)
    if url.drivername and not url.drivername.startswith("sqlite") and "+psycopg" not in url.drivername:
        url = url.set(drivername="postgresql+psycopg")
    
    print(f"Connecting to: {url.host}:{url.port}/{url.database}")
    engine = create_engine(url)
    
    with engine.connect() as conn:
        # 1. 查看当前约束
        result = conn.execute(text("""
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'daily_journals'::regclass AND contype = 'u'
        """))
        constraints = result.fetchall()
        print(f"\nCurrent constraints on daily_journals:")
        for c in constraints:
            print(f"  - {c[0]}: {c[1]}")
        
        # 2. 检查新约束是否已存在
        result = conn.execute(text("""
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'daily_journals'::regclass AND conname = 'uq_daily_journal_user_date_slot'
        """))
        if result.fetchone():
            print("\n✓ New constraint uq_daily_journal_user_date_slot already exists. No action needed.")
            return
        
        # 3. 清理重复数据
        print("\nCleaning duplicate data...")
        result = conn.execute(text("""
            DELETE FROM daily_journals 
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, journal_date, time_slot ORDER BY created_at DESC) as rn
                    FROM daily_journals
                ) ranked WHERE rn > 1
            )
        """))
        print(f"  Deleted {result.rowcount} duplicate rows")
        
        # 4. 删除旧约束
        for c in constraints:
            print(f"  Dropping constraint: {c[0]}")
            conn.execute(text(f"ALTER TABLE daily_journals DROP CONSTRAINT IF EXISTS {c[0]}"))
        
        # 5. 添加新约束
        print("\nAdding new constraint uq_daily_journal_user_date_slot...")
        conn.execute(text("""
            ALTER TABLE daily_journals ADD CONSTRAINT uq_daily_journal_user_date_slot
            UNIQUE (user_id, journal_date, time_slot)
        """))
        
        # 6. 验证
        result = conn.execute(text("""
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'daily_journals'::regclass AND conname = 'uq_daily_journal_user_date_slot'
        """))
        if result.fetchone():
            print("\n✓ Constraint uq_daily_journal_user_date_slot added successfully!")
        else:
            print("\n✗ Failed to add constraint!")
            sys.exit(1)
        
        conn.commit()
    
    print("\nMigration completed successfully!")

if __name__ == "__main__":
    main()
