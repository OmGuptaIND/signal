from __future__ import annotations

import argparse
from datetime import datetime

from .config import load_config
from .models import OIFeatures, Signal, StrategyContext
from .strategy.template_d import TemplateDStrategy


def _ctx(features_by_timeframe: dict[str, OIFeatures]) -> StrategyContext:
    return StrategyContext(
        timestamp=datetime(2026, 3, 6, 10, 0),
        index="NIFTY",
        spot_price=22500.0,
        atm_strike=22500,
        features_by_timeframe=features_by_timeframe,
    )


def run_cases(config_path: str) -> int:
    cfg = load_config(config_path)
    strategy = TemplateDStrategy(cfg.template_d)

    long_f = OIFeatures(1000, 1300, -70, 100, 0.17, 0.06)
    short_f = OIFeatures(1300, 1000, 100, -70, -0.17, -0.06)
    weak_f = OIFeatures(1100, 1110, -0.2, 0.2, 0.01, 0.01)
    ex2_f = OIFeatures(1000, 1010, -1, 1, 0.0, 0.0)

    cases = [
        (
            "bullish_consensus",
            _ctx({"1m": long_f, "3m": long_f, "5m": weak_f}),
            Signal.LONG_BIAS,
        ),
        (
            "bearish_consensus",
            _ctx({"1m": short_f, "3m": short_f, "5m": weak_f}),
            Signal.SHORT_BIAS,
        ),
        (
            "mixed_conflict",
            _ctx({"1m": long_f, "3m": short_f, "5m": weak_f}),
            Signal.NEUTRAL,
        ),
        (
            "weak_noise",
            _ctx({"1m": weak_f, "3m": weak_f, "5m": weak_f}),
            Signal.NEUTRAL,
        ),
        (
            "example_total_delta_2",
            _ctx({"1m": ex2_f, "3m": ex2_f, "5m": ex2_f}),
            Signal.LONG_BIAS,
        ),
    ]

    failures = 0
    for name, ctx, expected in cases:
        result = strategy.evaluate(ctx)
        ok = result.signal == expected
        status = "PASS" if ok else "FAIL"
        print(
            f"{status} {name}: expected={expected.value} got={result.signal.value} "
            f"confidence={result.confidence:.4f} total_delta={result.total_delta:.4f} "
            f"weighted_total_delta={result.weighted_total_delta:.4f} votes={result.votes}"
        )
        if not ok:
            failures += 1

    if failures:
        print(f"Template D case validation failed ({failures} case(s)).")
        return 1

    print("Template D case validation passed.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Template D alert scenario checks")
    parser.add_argument("--config", default="config.yaml", help="Path to config file")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return run_cases(args.config)


if __name__ == "__main__":
    raise SystemExit(main())
