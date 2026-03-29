from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    image = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC))


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC))


class KiteAuthStatus(Base):
    __tablename__ = "kite_auth_status"

    id = Column(Integer, primary_key=True, index=True)
    is_connected = Column(Boolean, default=False)
    last_updated_at = Column(DateTime(timezone=True), default=datetime.now(tz=UTC))
    message = Column(String, default="")


class StrategyRun(Base):
    __tablename__ = "strategy_runs"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(String, default="template_d", index=True)
    status = Column(String, default="starting")  # starting, running, stopped, expired, error
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(tz=UTC))
    stopped_at = Column(DateTime(timezone=True), nullable=True)
    access_token = Column(String, default="")
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)
    signals_count = Column(Integer, default=0)


class AlertSignal(Base):
    __tablename__ = "alert_signals"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("strategy_runs.id"), nullable=True, index=True)
    strategy_id = Column(String, default="template_d", index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    index_name = Column(String, index=True)
    signal = Column(String)
    confidence = Column(Float)
    total_delta = Column(Float)
    weighted_total_delta = Column(Float)
    timeframe_votes = Column(String)
    spot_price = Column(Float)
    atm_strike = Column(Integer)
    reason = Column(String)
