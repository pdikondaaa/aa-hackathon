import logging
import os
from pathlib import Path


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logger.setLevel(getattr(logging, log_level, logging.INFO))

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)

    # File handler — wired after settings are available to avoid circular import
    try:
        from app.api.config.db_config import settings
        if hasattr(settings, 'LOG_DIR'):
            log_dir = Path(settings.LOG_DIR)
            log_dir.mkdir(parents=True, exist_ok=True)
            fh = logging.FileHandler(log_dir / "api_gateway.log", encoding="utf-8")
            fh.setFormatter(formatter)
            logger.addHandler(fh)
    except Exception:
        pass  # fall back to console-only if config unavailable at import time

    return logger
