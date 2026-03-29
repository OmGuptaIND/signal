from __future__ import annotations

import logging
import sys
from pathlib import Path

from loguru import logger


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).bind(module=record.name).log(level, record.getMessage())

def setup_intercept_handlers() -> None:
    # Overwrite the standard logging hierarchy completely so uvicorn gets caught
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
        _logger = logging.getLogger(name)
        _logger.handlers = [InterceptHandler()]
        _logger.propagate = False

# Default sink so library usage (including tests) has predictable INFO logging.
logger.remove()
logger.add(
    sys.stderr,
    level="INFO",
    backtrace=False,
    diagnose=False,
    enqueue=True,
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[module]} | {message}",
)


def configure_logging(
    *,
    level: str = "INFO",
    json_logs: bool = False,
    log_file: str | None = None,
) -> None:
    """Configure global loguru logging sinks."""
    logger.remove()
    logger.add(
        sys.stderr,
        level=level.upper(),
        serialize=json_logs,
        backtrace=False,
        diagnose=False,
        enqueue=True,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[module]} | {message}",
    )
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        logger.add(
            log_file,
            level=level.upper(),
            serialize=json_logs,
            backtrace=False,
            diagnose=False,
            enqueue=True,
            rotation="10 MB",
            retention=5,
        )


def get_logger(module_name: str):
    return logger.bind(module=module_name)
