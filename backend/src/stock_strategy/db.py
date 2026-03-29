from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .logging_setup import get_logger

logger = get_logger(__name__)

Base = declarative_base()


class DatabaseClient:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("DATABASE_URL is required to initialize DatabaseClient")
        self.engine = create_engine(database_url, pool_pre_ping=True)
        self.session_factory = sessionmaker(
            bind=self.engine, autoflush=False, autocommit=False
        )

    def init_db(self) -> None:
        # Import models here to ensure they are registered with Base
        from . import models_db  # noqa: F401

        logger.info("Initializing database tables...")
        Base.metadata.create_all(bind=self.engine)
        self._migrate()
        logger.info("Database tables initialized.")

    def _migrate(self) -> None:
        """Apply column migrations for tables that already existed before model changes."""
        migrations = [
            (
                "alert_signals",
                "run_id",
                "ALTER TABLE alert_signals ADD COLUMN run_id INTEGER REFERENCES strategy_runs(id)",
            ),
        ]
        from sqlalchemy import text

        with self.engine.connect() as conn:
            for table, column, ddl in migrations:
                result = conn.execute(
                    text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = :column"
                    ),
                    {"table": table, "column": column},
                )
                if result.fetchone() is None:
                    logger.info("Migrating: adding column {}.{}", table, column)
                    conn.execute(text(ddl))
                    conn.commit()

    def get_session(self) -> Iterator[Session]:
        db = self.session_factory()
        try:
            yield db
        finally:
            db.close()
