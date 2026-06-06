import json
import os
from datetime import datetime, timedelta
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_TTL_HOURS = 24


def _cache_path(key: str) -> Path:
    CACHE_DIR.mkdir(exist_ok=True)
    safe = key.replace("/", "_").replace(":", "_")
    return CACHE_DIR / f"{safe}.json"


def get_cached(key: str):
    p = _cache_path(key)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        cached_at = datetime.fromisoformat(data["_cached_at"])
        if datetime.utcnow() - cached_at > timedelta(hours=CACHE_TTL_HOURS):
            return None
        return data["payload"]
    except Exception:
        return None


def set_cached(key: str, payload):
    p = _cache_path(key)
    p.write_text(json.dumps({"_cached_at": datetime.utcnow().isoformat(), "payload": payload}))


def clear_cache():
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.json"):
            f.unlink()
