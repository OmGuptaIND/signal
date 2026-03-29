from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from stock_strategy.alerts import DatabaseAlertSink
from stock_strategy.db import DatabaseClient
from stock_strategy.config import AppConfig, TemplateDConfig
from stock_strategy.engine import StrategyEngine
from stock_strategy.replay import run_replay
from stock_strategy.strategy.template_d import TemplateDStrategy


class ReplayTest(unittest.TestCase):
    def test_replay_runs(self) -> None:
        with TemporaryDirectory() as tmp:
            feature_csv = Path(tmp) / "features.csv"
            out_csv = Path(tmp) / "signals.csv"

            with feature_csv.open("w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(
                    fh,
                    fieldnames=[
                        "timestamp",
                        "index",
                        "spot_price",
                        "atm_strike",
                        "ce_oi_total",
                        "pe_oi_total",
                        "ce_oi_delta",
                        "pe_oi_delta",
                        "imbalance",
                        "momentum",
                    ],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "timestamp": datetime(2026, 3, 5, 10, 0).isoformat(),
                        "index": "NIFTY",
                        "spot_price": "22500",
                        "atm_strike": "22500",
                        "ce_oi_total": "1000",
                        "pe_oi_total": "1200",
                        "ce_oi_delta": "-20",
                        "pe_oi_delta": "30",
                        "imbalance": "0.09",
                        "momentum": "0.02",
                    }
                )
                writer.writerow(
                    {
                        "timestamp": datetime(2026, 3, 5, 10, 1).isoformat(),
                        "index": "NIFTY",
                        "spot_price": "22520",
                        "atm_strike": "22500",
                        "ce_oi_total": "1010",
                        "pe_oi_total": "1250",
                        "ce_oi_delta": "-10",
                        "pe_oi_delta": "50",
                        "imbalance": "0.11",
                        "momentum": "0.03",
                    }
                )

            config = AppConfig(
                symbols=["NIFTY", "BANKNIFTY", "SENSEX"],
                strike_window=5,
                market_start="09:15",
                market_end="15:30",
                timezone="Asia/Kolkata",
                compute_interval_seconds=60,
                csv_path=str(out_csv),
                dedup_confidence_delta=0.1,
                template_d=TemplateDConfig(
                    weights={"1m": 0.5, "3m": 0.3, "5m": 0.2},
                    min_oi_delta=5.0,
                    signal_threshold=0.1,
                    min_consensus_weight=0.5,
                    confidence_scale=2.5,
                ),
            )

            db_client = DatabaseClient("sqlite:///:memory:")
            db_client.init_db()

            engine = StrategyEngine(
                config=config,
                strategy=TemplateDStrategy(config.template_d),
                alerts=DatabaseAlertSink(db_client, dedup_confidence_delta=0.1),
            )
            summary = run_replay(engine, str(feature_csv))
            self.assertEqual(summary.rows, 2)
            self.assertGreaterEqual(int(summary.report["evaluations"]), 2)


if __name__ == "__main__":
    unittest.main()
