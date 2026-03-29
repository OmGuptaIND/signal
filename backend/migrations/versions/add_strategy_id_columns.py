"""add strategy_id to strategy_runs and alert_signals

Revision ID: a2f3b4c5d6e7
Revises: fb41ee0c358d
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "a2f3b4c5d6e7"
down_revision = "fb41ee0c358d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("strategy_runs", sa.Column("strategy_id", sa.String(), server_default="template_d"))
    op.create_index("ix_strategy_runs_strategy_id", "strategy_runs", ["strategy_id"])

    op.add_column("alert_signals", sa.Column("strategy_id", sa.String(), server_default="template_d"))
    op.create_index("ix_alert_signals_strategy_id", "alert_signals", ["strategy_id"])


def downgrade() -> None:
    op.drop_index("ix_alert_signals_strategy_id", "alert_signals")
    op.drop_column("alert_signals", "strategy_id")

    op.drop_index("ix_strategy_runs_strategy_id", "strategy_runs")
    op.drop_column("strategy_runs", "strategy_id")
