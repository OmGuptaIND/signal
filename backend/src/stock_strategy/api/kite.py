import asyncio
import os
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from ..config import load_config
from ..instruments import INDEX_SPOT_SYMBOLS
from ..kite_client import KiteClientError, KiteConnectClient
from ..logging_setup import configure_logging, get_logger
from ..models_db import KiteAuthStatus
from .core import get_db_session, get_run_manager, get_secrets, reload_secrets

logger = get_logger(__name__)


class TokenExchangeRequest(BaseModel):
    request_token: str = ""
    access_token: str = ""
    persist_access_token: bool = True
    start_run: bool = True
    env_path: str = ".env"


class KiteRouter:
    def __init__(self):
        self.router = APIRouter()
        self.runtime_request_token: str = ""
        self.runtime_request_received_at: str = ""
        self._setup_routes()

    def _setup_routes(self):
        self.router.add_api_route("/kite/connectivity", self.kite_connectivity, methods=["GET"])
        self.router.add_api_route("/kite/login-url", self.kite_login_url, methods=["GET"])
        self.router.add_api_route("/kite/callback", self.kite_callback, methods=["GET"], response_class=HTMLResponse)
        self.router.add_api_route("/kite/exchange-token", self.kite_exchange_token, methods=["POST"])
        self.router.add_api_route("/kite/credentials-status", self.kite_credentials_status, methods=["GET"])

    @staticmethod
    def _upsert_env_value(env_path: str, key: str, value: str) -> None:
        path = Path(env_path)
        if path.exists():
            lines = path.read_text(encoding="utf-8").splitlines()
        else:
            lines = []

        replaced = False
        output: list[str] = []
        for line in lines:
            if line.strip().startswith(f"{key}="):
                output.append(f"{key}={value}")
                replaced = True
            else:
                output.append(line)

        if not replaced:
            if output and output[-1].strip() != "":
                output.append("")
            output.append(f"{key}={value}")

        path.write_text("\n".join(output) + "\n", encoding="utf-8")

    @staticmethod
    def _update_auth_status(session, is_connected: bool, message: str) -> None:
        if not session:
            return
        try:
            status = session.query(KiteAuthStatus).first()
            if not status:
                status = KiteAuthStatus()
                session.add(status)
            status.is_connected = is_connected
            status.message = message
            status.last_updated_at = datetime.now()
            session.commit()
        except Exception as exc:
            logger.warning("Failed to update KiteAuthStatus: {}", exc)

    async def _resolve_access_token(
        self,
        request_token: str,
        access_token: str,
        api_key: str,
        api_secret: str,
    ) -> str:
        if access_token:
            return access_token

        if not request_token:
            raise HTTPException(status_code=400, detail="Either request_token or access_token is required")

        if not api_key:
            raise HTTPException(status_code=400, detail="Missing KITE_API_KEY")
        if not api_secret:
            raise HTTPException(status_code=400, detail="Missing KITE_API_SECRET")

        try:
            from kiteconnect import KiteConnect
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="kiteconnect package is not installed") from exc

        kite = KiteConnect(api_key=api_key)
        session_data = await asyncio.to_thread(kite.generate_session, request_token, api_secret=api_secret)
        resolved_access_token = str(session_data.get("access_token", ""))
        if not resolved_access_token:
            raise HTTPException(status_code=502, detail="Kite session did not return an access token")
        return resolved_access_token

    async def kite_exchange_token(
        self,
        body: TokenExchangeRequest,
        secrets=Depends(get_secrets),
        run_manager=Depends(get_run_manager),
        session=Depends(get_db_session),
    ) -> dict:
        request_token = body.request_token.strip()
        access_token = body.access_token.strip()

        if request_token:
            self.runtime_request_token = request_token
            self.runtime_request_received_at = datetime.now().isoformat(timespec="seconds")
            logger.info("captured runtime request_token at {}", self.runtime_request_received_at)

        resolved_access_token = await self._resolve_access_token(
            request_token=request_token,
            access_token=access_token,
            api_key=secrets.kite_api_key,
            api_secret=secrets.kite_api_secret,
        )

        if body.persist_access_token:
            self._upsert_env_value(body.env_path, "KITE_ACCESS_TOKEN", resolved_access_token)
            self._upsert_env_value(body.env_path, "KITE_ACCESS_TOKEN_ONLY", "true")
            logger.info("persisted kite access token to env_path={}", body.env_path)

        # Refresh dependency snapshot to immediately use latest token.
        updated_secrets = reload_secrets(body.env_path)

        run = None
        if body.start_run and run_manager:
            if not updated_secrets.kite_api_key or not updated_secrets.kite_api_secret:
                raise HTTPException(status_code=400, detail="KITE_API_KEY and KITE_API_SECRET are required to start run")
            run = await run_manager.start_run(
                access_token=resolved_access_token,
                api_key=updated_secrets.kite_api_key,
                api_secret=updated_secrets.kite_api_secret,
            )

        self._update_auth_status(session, True, "Token updated and connected")

        return {
            "status": "ok",
            "access_token_present": True,
            "request_token_received": bool(request_token),
            "persisted_access_token": body.persist_access_token,
            "run": run,
            "runtime_request_received_at": self.runtime_request_received_at,
        }

    def kite_connectivity(
        self,
        config_path: str = Query(default="config.yaml"),
        secrets=Depends(get_secrets),
        session=Depends(get_db_session),
    ) -> dict:
        """Validate that credentials can authenticate and fetch a live quote from Kite."""
        configure_logging(
            level=secrets.log_level,
            json_logs=secrets.log_json,
            log_file=secrets.log_file or None,
        )

        cfg = load_config(config_path)
        symbol = cfg.symbols[0] if cfg.symbols else "NIFTY"
        ltp_symbol = INDEX_SPOT_SYMBOLS.get(symbol, INDEX_SPOT_SYMBOLS["NIFTY"])
        effective_request_token = secrets.kite_request_token or self.runtime_request_token

        def _check() -> dict:
            started = time.perf_counter()
            client = KiteConnectClient(
                api_key=secrets.kite_api_key,
                api_secret=secrets.kite_api_secret,
                access_token=secrets.kite_access_token,
                request_token=effective_request_token,
                redirected_url=secrets.kite_redirected_url,
                access_token_only=secrets.kite_access_token_only,
            )
            try:
                quotes = client.get_ltp([ltp_symbol])
                if ltp_symbol not in quotes:
                    raise KiteClientError(f"Quote not returned for {ltp_symbol}")
                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                return {
                    "status": "ok",
                    "symbol": symbol,
                    "ltp_symbol": ltp_symbol,
                    "last_price": quotes[ltp_symbol],
                    "latency_ms": latency_ms,
                    "auth_mode": (
                        "access_token"
                        if secrets.kite_access_token
                        else (
                            "api_key_api_secret_request_token"
                            if effective_request_token
                            else "api_key_api_secret_redirected_url"
                        )
                    ),
                    "runtime_request_token_used": bool(self.runtime_request_token and not secrets.kite_request_token),
                    "access_token_only_mode": secrets.kite_access_token_only,
                }
            finally:
                client.stop()

        try:
            result = _check()
            logger.info("kite connectivity check passed symbol={} ltp={}", result["symbol"], result["last_price"])
            self._update_auth_status(session, True, "Connected successfully")
            return result
        except KiteClientError as exc:
            logger.warning("kite connectivity check failed: {}", exc)
            self._update_auth_status(session, False, f"Kite client error: {exc}")
            raise HTTPException(status_code=400, detail=f"Kite auth/config error: {exc}") from exc
        except Exception as exc:
            logger.exception("kite connectivity check failed unexpectedly: {}", exc)
            self._update_auth_status(session, False, f"Unexpected error: {exc}")
            raise HTTPException(status_code=502, detail=f"Kite connectivity failed: {exc}") from exc

    def kite_login_url(self, secrets=Depends(get_secrets)) -> dict:
        """Returns Kite login URL derived from configured API key."""
        try:
            from kiteconnect import KiteConnect
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="kiteconnect package is not installed") from exc

        if not secrets.kite_api_key:
            raise HTTPException(status_code=400, detail="Missing KITE_API_KEY")

        kite = KiteConnect(api_key=secrets.kite_api_key)
        return {"login_url": kite.login_url()}

    async def kite_callback(
        self,
        request_token: str = Query(default=""),
        action: str = Query(default=""),
        status: str = Query(default=""),
        env_path: str = Query(default=".env"),
        run_manager=Depends(get_run_manager),
        secrets=Depends(get_secrets),
        session=Depends(get_db_session),
    ):
        if not request_token:
            logger.warning("kite callback hit without request_token action={} status={}", action, status)
            return HTMLResponse(
                "<h2>Kite callback reached, but no request_token was found.</h2>"
                "<p>Check your Kite app redirect URL and login status.</p>",
                status_code=400,
            )

        try:
            result = await self.kite_exchange_token(
                TokenExchangeRequest(
                    request_token=request_token,
                    persist_access_token=True,
                    start_run=True,
                    env_path=env_path,
                ),
                secrets=secrets,
                run_manager=run_manager,
                session=session,
            )
        except HTTPException as exc:
            logger.warning("kite callback token exchange failed detail={}", exc.detail)
            return HTMLResponse(f"<h2>Auth Failed</h2><p>{exc.detail}</p>", status_code=exc.status_code)
        except Exception as exc:
            logger.error("kite callback token exchange failed: {}", exc)
            return HTMLResponse(f"<h2>Auth Failed</h2><p>{exc}</p>", status_code=500)

        frontend_url = os.getenv("FRONTEND_BASE_URL", "").strip()
        if frontend_url:
            callback_url = f"{frontend_url.rstrip('/')}/api/auth/callback?{urlencode({'request_token': request_token})}"
            return RedirectResponse(url=callback_url)

        run_id = result.get("run", {}).get("id") if isinstance(result.get("run"), dict) else None
        return HTMLResponse(
            "<h2>Kite login complete</h2>"
            f"<p>Token captured successfully. Run started: {run_id if run_id else 'no'}.</p>"
        )

    def kite_credentials_status(self, secrets=Depends(get_secrets)) -> dict:
        parsed = urlparse(secrets.kite_redirected_url) if secrets.kite_redirected_url else None
        query = parse_qs(parsed.query) if parsed else {}
        return {
            "api_key_present": bool(secrets.kite_api_key),
            "api_secret_present": bool(secrets.kite_api_secret),
            "access_token_present": bool(secrets.kite_access_token),
            "access_token_only_mode": secrets.kite_access_token_only,
            "request_token_present": bool(secrets.kite_request_token),
            "runtime_request_token_present": bool(self.runtime_request_token),
            "runtime_request_received_at": self.runtime_request_received_at,
            "redirected_url_present": bool(secrets.kite_redirected_url),
            "redirected_url_has_query": bool(parsed and parsed.query),
            "redirected_url_query_keys": sorted(query.keys()),
            "redirected_url_has_request_token": bool(query.get("request_token", [])),
        }
