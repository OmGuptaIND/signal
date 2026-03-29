from __future__ import annotations

import argparse
import asyncio
import signal
from datetime import UTC, date, datetime, timedelta

from .alerts import DatabaseAlertSink
from .config import RuntimeSecrets, load_config, load_secrets
from .db import DatabaseClient
from .engine import StrategyEngine
from .instruments import INDEX_SPOT_SYMBOLS
from .kite_client import KiteClientError, KiteConnectClient, prepare_live_subscription
from .logging_setup import configure_logging, get_logger
from .models import Tick
from .models_db import KiteAuthStatus
from .oi_aggregator import LiveOIAggregator
from .replay import run_replay_async
from .strategy.template_d import TemplateDStrategy

logger = get_logger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live OI strategy engine")
    sub = parser.add_subparsers(dest="command", required=True)

    live = sub.add_parser("live", help="Run live alert engine")
    live.add_argument("--config", default="config.yaml")
    live.add_argument("--env", default=".env")

    replay = sub.add_parser("replay", help="Replay stored feature snapshots")
    replay.add_argument("--config", default="config.yaml")
    replay.add_argument("--input", required=True)
    replay.add_argument("--env", default=".env")

    return parser


def _setup_runtime_logging(env_path: str) -> RuntimeSecrets:
    secrets = load_secrets(env_path)
    configure_logging(
        level=secrets.log_level,
        json_logs=secrets.log_json,
        log_file=secrets.log_file or None,
    )
    logger.info(
        "runtime logging configured level={} json_logs={} file={}",
        secrets.log_level,
        secrets.log_json,
        secrets.log_file or "<stderr-only>",
    )
    return secrets


async def cmd_live_async(config_path: str, env_path: str) -> int:
    secrets = _setup_runtime_logging(env_path)
    logger.info("starting live mode: config={} env={}", config_path, env_path)

    cfg = load_config(config_path)
    strategy = TemplateDStrategy(cfg.template_d)

    db_client = DatabaseClient(secrets.database_url)
    db_client.init_db()
    alerts = DatabaseAlertSink(db_client, cfg.dedup_confidence_delta)

    engine = StrategyEngine(cfg, strategy, alerts)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _request_stop() -> None:
        if not stop_event.is_set():
            logger.warning("shutdown signal received, stopping live loop")
            stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_stop)
        except NotImplementedError:
            signal.signal(sig, lambda *_args: _request_stop())

    while not stop_event.is_set():
        try:
            secrets = load_secrets(env_path)

            client = KiteConnectClient(
                api_key=secrets.kite_api_key,
                api_secret=secrets.kite_api_secret,
                access_token=secrets.kite_access_token,
                request_token=secrets.kite_request_token,
                redirected_url=secrets.kite_redirected_url,
                access_token_only=secrets.kite_access_token_only,
            )

            logger.info("loading instrument master and resolving subscription universe")
            raw_instruments = client.load_instruments()
            ltp_symbols = [INDEX_SPOT_SYMBOLS[symbol] for symbol in cfg.symbols]
            spot_quotes = client.get_ltp(ltp_symbols)
            spot_prices = {symbol: spot_quotes[INDEX_SPOT_SYMBOLS[symbol]] for symbol in cfg.symbols}
            logger.info("initial spot prices resolved: {}", spot_prices)

            with db_client.session_factory() as session:
                status = session.query(KiteAuthStatus).first()
                if not status:
                    status = KiteAuthStatus()
                    session.add(status)
                status.is_connected = True
                status.message = "Connected from live engine"
                status.last_updated_at = datetime.now()
                session.commit()

            subscription = prepare_live_subscription(
                raw_instruments=raw_instruments,
                symbols=cfg.symbols,
                strike_window=cfg.strike_window,
                spot_prices=spot_prices,
                today=date.today(),
            )

            aggregator = LiveOIAggregator(
                option_meta_by_token=subscription.option_meta_by_token,
                spot_token_to_index=subscription.spot_token_to_index,
                strike_window=cfg.strike_window,
                initial_spot_by_index=spot_prices,
            )

            tick_queue: asyncio.Queue[Tick] = asyncio.Queue(maxsize=50_000)
            stale_warned: set[str] = set()
            heartbeat_interval = timedelta(seconds=20)
            last_heartbeat_at = datetime.now(tz=UTC)
            ticks_enqueued = 0
            ticks_processed = 0
            snapshots_emitted = 0

            def _on_tick(tick: Tick) -> None:
                def _enqueue() -> None:
                    nonlocal ticks_enqueued
                    if stop_event.is_set():
                        return
                    try:
                        tick_queue.put_nowait(tick)
                        ticks_enqueued += 1
                    except asyncio.QueueFull:
                        logger.error("tick queue full; dropping tick token={}", tick.instrument_token)
                loop.call_soon_threadsafe(_enqueue)

            client.stream_ticks(subscription.tokens, _on_tick)
            logger.info(
                "live websocket started; symbols={} subscribed_tokens={}",
                cfg.symbols,
                len(subscription.tokens),
            )

            async def _drain_tick_queue() -> None:
                nonlocal ticks_processed, snapshots_emitted
                processed = 0
                while not tick_queue.empty():
                    tick = tick_queue.get_nowait()
                    ticks_processed += 1
                    snapshots = aggregator.process_tick(tick)
                    snapshots_emitted += len(snapshots)
                    now = datetime.now(tz=UTC)
                    for snap in snapshots:
                        engine.process_snapshot(snap, received_at=now)
                    processed += 1
                if processed:
                    logger.info("drained pending ticks count={}", processed)

            try:
                while not stop_event.is_set():
                    try:
                        tick = await asyncio.wait_for(tick_queue.get(), timeout=1.0)
                        ticks_processed += 1
                        snapshots = aggregator.process_tick(tick)
                        snapshots_emitted += len(snapshots)
                        now = datetime.now(tz=UTC)
                        for snap in snapshots:
                            engine.process_snapshot(snap, received_at=now)
                        if snapshots:
                            logger.info(
                                "snapshot batch processed count={} source_token={} snapshot_minute={}",
                                len(snapshots),
                                tick.instrument_token,
                                snapshots[0].timestamp,
                            )
                    except TimeoutError:
                        pass

                    now_utc = datetime.now(tz=UTC)
                    if now_utc - last_heartbeat_at >= heartbeat_interval:
                        telemetry = aggregator.telemetry()
                        if aggregator.current_minute is None:
                            waiting_detail = "waiting for first tick"
                        else:
                            next_minute_close = aggregator.current_minute + timedelta(minutes=1)
                            eta_seconds = max(0, int((next_minute_close - now_utc).total_seconds()))
                            waiting_detail = (
                                f"collecting current_minute={aggregator.current_minute.isoformat()} "
                                f"next_close_utc={next_minute_close.isoformat()} eta_seconds={eta_seconds}"
                            )
                        logger.info(
                            "live heartbeat: checking feed and waiting for data; {} queue_size={} ticks_enqueued={} ticks_processed={} snapshots_emitted={} evaluations={} alerts={} spot_ticks={} option_ticks={} option_ticks_with_oi={}",
                            waiting_detail,
                            tick_queue.qsize(),
                            ticks_enqueued,
                            ticks_processed,
                            snapshots_emitted,
                            engine.stats.evaluations,
                            engine.stats.emitted_alerts,
                            telemetry["spot_ticks"],
                            telemetry["option_ticks"],
                            telemetry["option_ticks_with_oi"],
                        )
                        last_heartbeat_at = now_utc

                    stale = aggregator.detect_stale_indices(datetime.now(tz=UTC), max_age_seconds=180)
                    stale_set = set(stale)
                    new_stale = sorted(stale_set - stale_warned)
                    recovered = sorted(stale_warned - stale_set)
                    if new_stale:
                        logger.warning("stale feed detected for indices={}", ",".join(new_stale))
                    if recovered:
                        logger.info("feed recovered for indices={}", ",".join(recovered))
                    stale_warned = stale_set

                await _drain_tick_queue()
                for snap in aggregator.finalize():
                    engine.process_snapshot(snap, received_at=datetime.now(tz=UTC))
            finally:
                client.stop()

        except Exception as exc:
            logger.error("live connection error: {}", exc)
            with db_client.session_factory() as session:
                status = session.query(KiteAuthStatus).first()
                if not status:
                    status = KiteAuthStatus()
                    session.add(status)
                status.is_connected = False
                status.message = str(exc)
                status.last_updated_at = datetime.now()
                session.commit()

            if not stop_event.is_set():
                logger.info("retrying connection in 10 seconds...")
                await asyncio.sleep(10)

    logger.info("live mode finished with report={}", engine.report())
    return 0


async def cmd_replay_async(config_path: str, input_path: str, env_path: str) -> int:
    secrets = _setup_runtime_logging(env_path)
    logger.info(
        "starting replay mode: config={} input={} env={}",
        config_path,
        input_path,
        env_path,
    )
    cfg = load_config(config_path)
    strategy = TemplateDStrategy(cfg.template_d)

    db_client = DatabaseClient(secrets.database_url)
    db_client.init_db()
    alerts = DatabaseAlertSink(db_client, cfg.dedup_confidence_delta)

    engine = StrategyEngine(cfg, strategy, alerts)

    summary = await run_replay_async(engine, input_path)
    logger.info("replay completed rows={} report={}", summary.rows, summary.report)
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "live":
            return asyncio.run(cmd_live_async(config_path=args.config, env_path=args.env))
        if args.command == "replay":
            return asyncio.run(
                cmd_replay_async(
                    config_path=args.config,
                    input_path=args.input,
                    env_path=args.env,
                )
            )
    except KiteClientError as exc:
        logger.exception("kite client error: {}", exc)
        return 2
    except Exception as exc:
        logger.exception("fatal error: {}", exc)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
