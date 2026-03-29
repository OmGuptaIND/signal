from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .config import load_secrets
from .logging_setup import configure_logging, get_logger

logger = get_logger(__name__)


def _extract_request_token(redirected_url: str) -> str:
    if not redirected_url:
        return ""
    parsed = urlparse(redirected_url)
    values = parse_qs(parsed.query).get("request_token", [])
    return values[0] if values else ""


def _resolve_request_token(secrets, request_token_arg: str) -> str:
    if request_token_arg:
        return request_token_arg
    if secrets.kite_request_token:
        return secrets.kite_request_token
    return _extract_request_token(secrets.kite_redirected_url)


def _upsert_env_value(env_path: Path, key: str, value: str) -> None:
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()
    else:
        lines = []

    replaced = False
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}="):
            out.append(f"{key}={value}")
            replaced = True
        else:
            out.append(line)

    if not replaced:
        if out and out[-1].strip() != "":
            out.append("")
        out.append(f"{key}={value}")

    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")


def generate_access_token(env_path: str, request_token_arg: str, write_env: bool) -> dict[str, str]:
    secrets = load_secrets(env_path)
    configure_logging(
        level=secrets.log_level,
        json_logs=secrets.log_json,
        log_file=secrets.log_file or None,
    )

    if not secrets.kite_api_key:
        raise ValueError("Missing KITE_API_KEY")
    if not secrets.kite_api_secret:
        raise ValueError("Missing KITE_API_SECRET")

    request_token = _resolve_request_token(secrets, request_token_arg)
    if not request_token:
        raise ValueError(
            "Missing request token. Provide --request-token, or set KITE_REQUEST_TOKEN, "
            "or set KITE_REDIRECTED_URL containing request_token"
        )

    try:
        from kiteconnect import KiteConnect
    except ImportError as exc:
        raise RuntimeError("kiteconnect is not installed. Run: uv add 'kiteconnect>=5.0.0'") from exc

    kite = KiteConnect(api_key=secrets.kite_api_key)
    session = kite.generate_session(request_token, api_secret=secrets.kite_api_secret)

    access_token = str(session.get("access_token", ""))
    public_token = str(session.get("public_token", ""))
    user_id = str(session.get("user_id", ""))

    if not access_token:
        raise RuntimeError("Kite did not return access_token")

    if write_env:
        _upsert_env_value(Path(env_path), "KITE_ACCESS_TOKEN", access_token)
        logger.info("access token written to env file path={}", env_path)

    logger.info("access token generated successfully user_id={} write_env={}", user_id, write_env)
    return {
        "access_token": access_token,
        "public_token": public_token,
        "user_id": user_id,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate Zerodha Kite access token")
    parser.add_argument("--env", default=".env", help="Path to env file")
    parser.add_argument(
        "--request-token",
        default="",
        help="Optional request token override (otherwise uses env/redirect URL)",
    )
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="Write generated KITE_ACCESS_TOKEN into env file",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        data = generate_access_token(
            env_path=args.env,
            request_token_arg=args.request_token,
            write_env=args.write_env,
        )
    except Exception as exc:
        logger.exception("failed to generate access token: {}", exc)
        return 1

    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
