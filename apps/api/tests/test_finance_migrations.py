import os
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings
from app.core.database import engine as test_engine

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION_PATH = API_ROOT / "migrations" / "versions" / "20260817_add_finance_transaction_ledger.py"


def _load_ledger_migration():
    spec = spec_from_file_location("finance_transaction_ledger_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_finance_tests_use_an_isolated_sqlite_database() -> None:
    assert test_engine.dialect.name == "sqlite"
    assert "career_os_pytest_" in (test_engine.url.database or "")


def test_finance_ledger_migration_links_and_round_trips_without_full_history(tmp_path, monkeypatch) -> None:
    # Do not run a full SQLite ``alembic upgrade head`` here: the pre-existing
    # c7d8e9f0a1b2 migration uses an unsupported SQLite constraint alteration.
    # This test validates only the ledger revision from its direct predecessor.
    migration = _load_ledger_migration()
    assert migration.revision == "20260817_finance_ledger"
    assert migration.down_revision == "20260817_finance"

    database_path = tmp_path / "finance-ledger.db"
    database_url = f"sqlite:///{database_path}"
    database = create_engine(database_url)
    with database.begin() as connection:
        connection.execute(
            text("CREATE TABLE finance_transactions (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL)")
        )
        connection.execute(text("INSERT INTO finance_transactions (id, user_id) VALUES ('legacy-row', 'user-1')"))
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20260817_finance')"))

    original_database_url = os.environ["DATABASE_URL"]
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(API_ROOT / "alembic.ini"))
    try:
        command.upgrade(config, "head")
        with database.connect() as connection:
            assert connection.execute(text("SELECT client_reference FROM finance_transactions")).scalar_one() == "legacy-legacy-row"
            assert any(row[2] for row in connection.exec_driver_sql("PRAGMA index_list('finance_transactions')"))

        command.downgrade(config, "20260817_finance")
        with database.connect() as connection:
            assert "client_reference" not in {column["name"] for column in inspect(connection).get_columns("finance_transactions")}
    finally:
        monkeypatch.setenv("DATABASE_URL", original_database_url)
        get_settings.cache_clear()
        database.dispose()
