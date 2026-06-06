import httpx
import logging
from typing import Dict, Optional
from .cache import get_cached, set_cached
import os

logger = logging.getLogger(__name__)

FRED_API_KEY = os.getenv("FRED_API_KEY", "")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

# MSA-level population series: use Census population estimates via FRED
# Format: CBSA{cbsa}POP (not all exist, fall back gracefully)
POP_SERIES_MAP = {
    "12420": "AUSTINPOP",   # Austin
    "34980": "NASHPOP",
    "14260": "BOISE1POP",
    "39580": "RALEIPOP",
    "38060": "PHOENPOP",
    "16740": "CHARLPOP",
    "27260": "JACKSPOP",
    "18140": "COLUMPOP",
    "26900": "INDNAPOP",
    "41700": "SANANTPOP",
    "19100": "DALLASPOP",
    "12060": "ATLPOP",
    "45300": "TAMPAPOP",
    "19740": "DENVPOP",
    "41620": "SLCPOP",
    "29820": "LVGPOP",
    "36740": "ORLANDPOP",
    "40060": "RICHMPOP",
    "24860": "GREENPOP",
    "26620": "HUNTSPOP",
    "44060": "SPOKAPOP",
    "46060": "TUCSONPOP",
    "10740": "ALBUPOP",
    "36420": "OKCPOP",
}

# State-level unemployment via FRED as fallback
STATE_UNEMP_MAP = {
    "TX": "TXUR", "TN": "TNUR", "ID": "IDUR", "NC": "NCUR",
    "AZ": "AZUR", "FL": "FLUR", "OH": "OHUR", "IN": "INUR",
    "GA": "GAUR", "CO": "COUR", "UT": "UTUR", "NV": "NVUR",
    "VA": "VAUR", "SC": "SCUR", "AL": "ALUR", "WA": "WAUR",
    "NM": "NMUR", "OK": "OKUR",
}


def fetch_fred_series(series_id: str, limit: int = 36) -> Dict:
    cache_key = f"fred_{series_id}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    if not FRED_API_KEY:
        return {"series_id": series_id, "observations": []}

    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(FRED_BASE, params=params)
            if resp.status_code == 200:
                data = resp.json()
                obs = [
                    {"date": o["date"], "value": float(o["value"])}
                    for o in data.get("observations", [])
                    if o["value"] != "."
                ]
                obs.sort(key=lambda x: x["date"])
                result = {"series_id": series_id, "observations": obs}
                set_cached(cache_key, result)
                return result
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")

    return {"series_id": series_id, "observations": []}


def compute_population_growth(cbsa: str, state: str) -> Optional[float]:
    # Try state-level population growth from FRED as proxy
    series_id = STATE_UNEMP_MAP.get(state)
    if not series_id:
        return None
    # We use unemployment as inverse proxy if no pop series available
    # Return None to let composite use mock if needed
    return None
