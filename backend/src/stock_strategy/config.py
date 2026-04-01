from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .logging_setup import get_logger

logger = get_logger(__name__)


@dataclass(slots=True)
class TemplateDConfig:
    weights: dict[str, float]
    min_oi_delta: float
    signal_threshold: float
    min_consensus_weight: float
    confidence_scale: float


@dataclass(slots=True)
class AppConfig:
    symbols: list[str]
    strike_window: int
    market_start: str
    market_end: str
    timezone: str
    compute_interval_seconds: int
    csv_path: str
    dedup_confidence_delta: float
    template_d: TemplateDConfig


@dataclass(slots=True)
class RuntimeSecrets:
    kite_api_key: str
    kite_api_secret: str
    kite_access_token: str
    kite_request_token: str
    kite_redirected_url: str
    kite_access_token_only: bool
    dry_run: bool
    log_level: str
    log_json: bool
    log_file: str
    database_url: str
    internal_api_key: str
    frontend_base_url: str


def _parse_simple_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_secrets(env_path: str = ".env") -> RuntimeSecrets:
    file_values = _parse_simple_env(Path(env_path))

    def get(name: str, default: str = "") -> str:
        return os.getenv(name, file_values.get(name, default))

    secrets = RuntimeSecrets(
        kite_api_key=get("KITE_API_KEY"),
        kite_api_secret=get("KITE_API_SECRET"),
        kite_access_token=get("KITE_ACCESS_TOKEN"),
        kite_request_token=get("KITE_REQUEST_TOKEN"),
        kite_redirected_url=get("KITE_REDIRECTED_URL"),
        kite_access_token_only=get("KITE_ACCESS_TOKEN_ONLY", "false").lower()
        in {"1", "true", "yes"},
        dry_run=get("DRY_RUN", "true").lower() in {"1", "true", "yes"},
        log_level=get("LOG_LEVEL", "INFO"),
        log_json=get("LOG_JSON", "false").lower() in {"1", "true", "yes"},
        log_file=get("LOG_FILE", ""),
        database_url=get("DATABASE_URL", ""),
        internal_api_key=get("BACKEND_INTERNAL_KEY", ""),
        frontend_base_url=get("FRONTEND_BASE_URL", ""),
    )
    logger.debug(
        "runtime secrets loaded env_path={} dry_run={} log_level={} json_logs={} log_file_set={}",
        env_path,
        secrets.dry_run,
        secrets.log_level,
        secrets.log_json,
        bool(secrets.log_file),
    )
    return secrets


def _parse_yaml_or_json(content: str) -> dict[str, Any]:
    # YAML is a superset of JSON; this keeps runtime dependency-free by using JSON-compatible YAML.
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "config.yaml must be JSON-compatible YAML in this v1 implementation"
        ) from exc


def load_config(path: str) -> AppConfig:
    raw = _parse_yaml_or_json(Path(path).read_text(encoding="utf-8"))
    template = raw["template_d"]
    weights = template["weights"]
    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise ValueError("template_d.weights must sum to > 0")

    normalized_weights = {k: v / total_weight for k, v in weights.items()}

    cfg = AppConfig(
        symbols=raw["symbols"],
        strike_window=int(raw["strike_window"]),
        market_start=raw["market_start"],
        market_end=raw["market_end"],
        timezone=raw.get("timezone", "Asia/Kolkata"),
        compute_interval_seconds=int(raw.get("compute_interval_seconds", 60)),
        csv_path=raw["csv_path"],
        dedup_confidence_delta=float(raw.get("dedup_confidence_delta", 0.1)),
        template_d=TemplateDConfig(
            weights=normalized_weights,
            min_oi_delta=float(template.get("min_oi_delta", 1.0)),
            signal_threshold=float(template.get("signal_threshold", 0.15)),
            min_consensus_weight=float(template.get("min_consensus_weight", 0.5)),
            confidence_scale=float(template["confidence_scale"]),
        ),
    )
    logger.info(
        "app config loaded path={} symbols={} strike_window={} market_window={}..{}",
        path,
        cfg.symbols,
        cfg.strike_window,
        cfg.market_start,
        cfg.market_end,
    )
    return cfg
