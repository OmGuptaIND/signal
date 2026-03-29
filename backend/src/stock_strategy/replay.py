from __future__ import annotations

import asyncio
import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .engine import StrategyEngine
from .logging_setup import get_logger
from .models import MarketSnapshot, OIFeatures

logger = get_logger(__name__)


@dataclass(slots=True)
class ReplaySummary:
    rows: int
    report: dict[str, float | int]


def load_snapshots_csv(path: str) -> list[MarketSnapshot]:
    logger.info("loading replay snapshots from {}", path)
    rows: list[MarketSnapshot] = []
    with Path(path).open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(
                MarketSnapshot(
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                    index=row["index"],
                    spot_price=float(row["spot_price"]),
                    atm_strike=int(row["atm_strike"]),
                    features=OIFeatures(
                        ce_oi_total=float(row["ce_oi_total"]),
                        pe_oi_total=float(row["pe_oi_total"]),
                        ce_oi_delta=float(row["ce_oi_delta"]),
                        pe_oi_delta=float(row["pe_oi_delta"]),
                        imbalance=float(row["imbalance"]),
                        momentum=float(row["momentum"]),
                    ),
                )
            )
    rows.sort(key=lambda x: x.timestamp)
    logger.info("loaded replay snapshots rows={}", len(rows))
    return rows


def run_replay(engine: StrategyEngine, input_path: str) -> ReplaySummary:
    logger.info("starting replay run input={}", input_path)
    snapshots = load_snapshots_csv(input_path)
    for snapshot in snapshots:
        engine.process_snapshot(snapshot, received_at=snapshot.timestamp)
    summary = ReplaySummary(rows=len(snapshots), report=engine.report())
    logger.info("replay finished rows={} report={}", summary.rows, summary.report)
    return summary


async def run_replay_async(engine: StrategyEngine, input_path: str) -> ReplaySummary:
    """Async wrapper for replay to integrate with asyncio-based runners."""
    return await asyncio.to_thread(run_replay, engine, input_path)
