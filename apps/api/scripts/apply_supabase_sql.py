import os
from pathlib import Path

import psycopg


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    url = os.environ["DATABASE_URL"]
    sql_path = repo_root / "infra/supabase/migrations/0001_init.sql"
    sql = sql_path.read_text(encoding="utf-8")
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("applied:", sql_path)


if __name__ == "__main__":
    main()
