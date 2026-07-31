from pathlib import Path

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db import models  # noqa: F401
from app.db.base import Base


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    dialect = postgresql.dialect()
    lines: list[str] = ["-- Career OS full Supabase init (generated)", "BEGIN;"]
    for table in Base.metadata.sorted_tables:
        lines.append(f"DROP TABLE IF EXISTS public.{table.name} CASCADE;")
    lines.append("COMMIT;")
    lines.append("BEGIN;")
    for table in Base.metadata.sorted_tables:
        lines.append(str(CreateTable(table).compile(dialect=dialect)) + ";")
        for index in table.indexes:
            lines.append(str(CreateIndex(index).compile(dialect=dialect)) + ";")
        lines.append("")
    lines.append("COMMIT;")
    rls = (repo_root / "infra/supabase/migrations/0001_init.sql").read_text(encoding="utf-8")
    lines.append(rls)
    out = repo_root / "infra/supabase/migrations/0001_full_init.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
