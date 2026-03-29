from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from .instruments import parse_instruments, resolve_option_universe, resolve_spot_tokens
from .logging_setup import get_logger
from .models import OptionMeta, Tick

logger = get_logger(__name__)


TickHandler = Callable[[Tick], None]
EXCHANGE_TZ = ZoneInfo("Asia/Kolkata")


@dataclass(slots=True)
class LiveSubscription:
    option_meta_by_token: dict[int, OptionMeta]
    spot_token_to_index: dict[int, str]
    tokens: list[int]


class KiteClientError(RuntimeError):
    pass


class KiteConnectClient:
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        access_token: str = "",
        request_token: str = "",
        redirected_url: str = "",
        access_token_only: bool = False,
    ) -> None:
        if not api_key:
            raise KiteClientError("Missing KITE_API_KEY")

        try:
            from kiteconnect import KiteConnect, KiteTicker
        except ImportError as exc:
            raise KiteClientError(
                "kiteconnect is not installed. Run: uv add 'kiteconnect>=5.0.0'"
            ) from exc

        self._KiteTicker = KiteTicker
        self._api_key = api_key
        self._kite = KiteConnect(api_key=api_key)

        self._login_url = self._kite.login_url()
        resolved_request_token = request_token or _extract_request_token(redirected_url)

        if access_token_only and not access_token:
            raise KiteClientError(
                "KITE_ACCESS_TOKEN_ONLY is enabled, but KITE_ACCESS_TOKEN is missing. "
                "Generate and set KITE_ACCESS_TOKEN before running."
            )

        if access_token:
            self._access_token = access_token
            self._kite.set_access_token(self._access_token)
            logger.info("kite client initialized using provided access token")
        else:
            if not api_secret or not resolved_request_token:
                raise KiteClientError(
                    "Missing session credentials: provide KITE_ACCESS_TOKEN, "
                    "or provide KITE_API_SECRET + KITE_REQUEST_TOKEN, "
                    "or provide KITE_API_SECRET + KITE_REDIRECTED_URL. "
                    f"Login URL: {self._login_url}"
                )
            session = self._kite.generate_session(
                resolved_request_token,
                api_secret=api_secret,
            )
            self._access_token = str(session["access_token"])
            self._kite.set_access_token(self._access_token)
            logger.info("kite client initialized using api key + api secret session flow")
        self._ticker = None

    def load_instruments(self) -> list[dict]:
        try:
            rows = list(self._kite.instruments())
            logger.info("loaded instrument master rows={}", len(rows))
            return rows
        except Exception as exc:
            raise KiteClientError(f"Failed to load instruments: {exc}") from exc

    def get_ltp(self, symbols: list[str]) -> dict[str, float]:
        logger.info("fetching spot LTP for symbols={}", symbols)
        try:
            quote = self._kite.ltp(symbols)
            out: dict[str, float] = {}
            for symbol in symbols:
                if symbol in quote and "last_price" in quote[symbol]:
                    out[symbol] = float(quote[symbol]["last_price"])
            logger.info("ltp resolved count={}", len(out))
            return out
        except Exception as exc:
            raise KiteClientError(f"Failed to fetch ltp: {exc}") from exc

    def stream_ticks(self, tokens: list[int], on_tick: TickHandler) -> None:
        if not tokens:
            raise KiteClientError("No tokens provided for websocket subscription")

        ticker = self._KiteTicker(self._api_key, self._access_token, reconnect=True)
        logger.info("starting kite websocket token_count={}", len(tokens))

        def _on_connect(ws, _response):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)
            logger.info("websocket connected and subscribed token_count={}", len(tokens))

        def _on_ticks(_ws, ticks):
            now = datetime.now(tz=UTC)
            logger.debug("received websocket tick batch size={}", len(ticks))
            for raw in ticks:
                ts = raw.get("exchange_timestamp") or raw.get("last_trade_time") or now
                on_tick(
                    Tick(
                        instrument_token=int(raw["instrument_token"]),
                        last_price=float(raw.get("last_price", 0.0)),
                        oi=(float(raw["oi"]) if raw.get("oi") is not None else None),
                        timestamp=_normalize_exchange_timestamp(ts),
                    )
                )

        def _on_error(_ws, code, reason):
            logger.error("websocket error code={} reason={}", code, reason)

        def _on_reconnect(_ws, attempt_count):
            logger.warning("websocket reconnect attempt={}", attempt_count)

        def _on_noreconnect(_ws):
            logger.error("websocket reconnect attempts exhausted")

        ticker.on_connect = _on_connect
        ticker.on_ticks = _on_ticks
        ticker.on_error = _on_error
        ticker.on_reconnect = _on_reconnect
        ticker.on_noreconnect = _on_noreconnect
        self._ticker = ticker
        ticker.connect(threaded=True)

    def stop(self) -> None:
        if self._ticker is not None:
            self._ticker.close()
            self._ticker = None
            logger.info("kite websocket stopped")


def _extract_request_token(redirected_url: str) -> str:
    if not redirected_url:
        return ""
    query = parse_qs(urlparse(redirected_url).query)
    token_values = query.get("request_token", [])
    return token_values[0] if token_values else ""


def _normalize_exchange_timestamp(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        # Kite exchange timestamps are timezone-naive but represent IST.
        ts = ts.replace(tzinfo=EXCHANGE_TZ)
    return ts.astimezone(UTC)


def prepare_live_subscription(
    raw_instruments: list[dict],
    symbols: list[str],
    strike_window: int,
    spot_prices: dict[str, float],
    today: date,
) -> LiveSubscription:
    logger.info(
        "preparing subscription symbols={} strike_window={} today={}",
        symbols,
        strike_window,
        today,
    )
    instruments = parse_instruments(raw_instruments)
    spot_token_map = resolve_spot_tokens(instruments)

    option_meta_by_token: dict[int, OptionMeta] = {}
    tokens: set[int] = set()

    rows_by_token = {int(r["instrument_token"]): r for r in raw_instruments}

    for index in symbols:
        spot = spot_prices[index]
        universe = resolve_option_universe(
            instruments=instruments,
            index=index,
            spot_price=spot,
            strike_window=strike_window,
            today=today,
        )

        for token in universe.instrument_tokens:
            row = rows_by_token[token]
            option_meta_by_token[token] = OptionMeta(
                index=index,
                strike=int(float(row.get("strike", 0.0))),
                option_type=str(row.get("instrument_type", "")),
            )
            tokens.add(token)

        spot_token = spot_token_map.get(index)
        if spot_token is not None:
            tokens.add(spot_token)
        logger.info(
            "subscription resolved index={} expiry={} atm={} strikes={} option_tokens={} spot_token_present={}",
            index,
            universe.expiry,
            universe.atm_strike,
            len(universe.strikes),
            len(universe.instrument_tokens),
            spot_token is not None,
        )

    filtered_spot_tokens = {
        index: token for index, token in spot_token_map.items() if index in symbols
    }
    subscription = LiveSubscription(
        option_meta_by_token=option_meta_by_token,
        spot_token_to_index=filtered_spot_tokens,
        tokens=sorted(tokens),
    )
    logger.info(
        "final subscription token_count={} option_meta_count={} spot_indices={}",
        len(subscription.tokens),
        len(subscription.option_meta_by_token),
        sorted(subscription.spot_token_to_index.keys()),
    )
    return subscription
