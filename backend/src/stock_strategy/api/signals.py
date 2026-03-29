import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from ..events import broadcaster
from ..logging_setup import get_logger
from ..models_db import AlertSignal, KiteAuthStatus
from .core import get_db_session, get_secrets

logger = get_logger(__name__)


def _verify_stream_token(token: str, secret: str) -> bool:
    """Verify a short-lived HMAC-SHA256 stream token."""
    try:
        payload_b64, sig = token.rsplit(".", 1)
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        if not hmac.compare_digest(sig, expected_sig):
            return False
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        return payload.get("exp", 0) >= time.time()
    except Exception:
        return False


class SignalsRouter:
    def __init__(self):
        self.router = APIRouter()
        self._setup_routes()

    def _setup_routes(self):
        self.router.add_api_route("/api/signals/stream", self.signals_stream, methods=["GET"])
        self.router.add_api_route("/api/signals/history", self.signals_history, methods=["GET"])
        self.router.add_api_route("/api/auth/status", self.auth_status, methods=["GET"])

    async def signals_stream(
        self,
        stream_token: str = Query(...),
        secrets=Depends(get_secrets),
    ) -> EventSourceResponse:
        if not _verify_stream_token(stream_token, secrets.internal_api_key):
            raise HTTPException(status_code=401, detail="Invalid or expired stream token")
        return EventSourceResponse(broadcaster.stream())

    def signals_history(
        self,
        strategy_id: Optional[str] = Query(None),
        session=Depends(get_db_session),
    ) -> dict:
        if not session:
            return {"signals": []}

        try:
            query = session.query(AlertSignal)
            if strategy_id:
                query = query.filter(AlertSignal.strategy_id == strategy_id)
            signals = query.order_by(AlertSignal.timestamp.desc()).limit(50).all()
            return {
                "signals": [
                    {
                        "id": s.id,
                        "strategy_id": s.strategy_id or "template_d",
                        "timestamp": s.timestamp.isoformat(),
                        "index_name": s.index_name,
                        "signal": s.signal,
                        "confidence": s.confidence,
                        "total_delta": s.total_delta,
                        "weighted_total_delta": s.weighted_total_delta,
                        "timeframe_votes": s.timeframe_votes,
                        "spot_price": s.spot_price,
                        "atm_strike": s.atm_strike,
                        "reason": s.reason,
                    }
                    for s in signals
                ]
            }
        except Exception as exc:
            logger.error(f"Failed to fetch history: {exc}")
            return {"signals": []}

    def auth_status(self, session=Depends(get_db_session)) -> dict:
        if not session:
            return {"is_connected": False, "message": "Unknown", "last_updated_at": None}

        try:
            status = session.query(KiteAuthStatus).first()
            if status:
                return {
                    "is_connected": status.is_connected,
                    "message": status.message,
                    "last_updated_at": status.last_updated_at.isoformat() if status.last_updated_at else None,
                }
        except Exception as exc:
            logger.error(f"Failed to fetch auth status: {exc}")

        return {"is_connected": False, "message": "Unknown", "last_updated_at": None}
