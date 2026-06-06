import httpx
import logging
from typing import Optional, List, Dict
from .cache import get_cached, set_cached
import os
from datetime import datetime

logger = logging.getLogger(__name__)

CENSUS_API_KEY = os.getenv("CENSUS_API_KEY", "")
BPS_BASE = "https://www.census.gov/construction/bps/txt"
ACS_BASE = "https://api.census.gov/data"


def _get_bps_url(year: int, month: int) -> str:
    return f"{BPS_BASE}/ma{year}{month:02d}c.txt"


def fetch_permits_for_metro(cbsa: str, months: int = 24) -> Dict:
    cache_key = f"permits_{cbsa}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    now = datetime.utcnow()
    residential_series = []
    commercial_series = []

    for i in range(months):
        month = now.month - i - 1
        year = now.year
        while month <= 0:
            month += 12
            year -= 1

        url = _get_bps_url(year, month)
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(url)
                if resp.status_code != 200:
                    continue
                lines = resp.text.strip().split("\n")
                for line in lines:
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) < 10:
                        continue
                    if parts[0] == cbsa or parts[1] == cbsa:
                        date_str = f"{year}-{month:02d}"
                        try:
                            res_val = float(parts[4]) if parts[4] else 0
                            com_val = float(parts[6]) if parts[6] else 0
                            residential_series.append({"date": date_str, "value": res_val})
                            commercial_series.append({"date": date_str, "value": com_val})
                        except (ValueError, IndexError):
                            pass
                        break
        except Exception as e:
            logger.warning(f"BPS fetch failed for {cbsa} {year}-{month}: {e}")

    residential_series.sort(key=lambda x: x["date"])
    commercial_series.sort(key=lambda x: x["date"])

    result = {
        "cbsa": cbsa,
        "residential_series": residential_series,
        "commercial_series": commercial_series,
    }
    set_cached(cache_key, result)
    return result


def compute_permit_growth(permit_data: Dict) -> Optional[float]:
    res = permit_data.get("residential_series", [])
    com = permit_data.get("commercial_series", [])
    if len(res) < 13:
        return None
    total = [r["value"] + (com[i]["value"] if i < len(com) else 0) for i, r in enumerate(res)]
    recent_12 = sum(total[-12:])
    prior_12 = sum(total[-24:-12]) if len(total) >= 24 else sum(total[:-12])
    if prior_12 == 0:
        return None
    return round((recent_12 - prior_12) / prior_12 * 100, 2)


def fetch_acs_data(cbsa: str) -> Dict:
    cache_key = f"acs_{cbsa}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    year = 2022
    url = f"{ACS_BASE}/{year}/acs/acs5"
    params = {
        "get": "NAME,B01003_001E,B19013_001E",
        "for": f"metropolitan+statistical+area/micropolitan+statistical+area:{cbsa}",
    }
    if CENSUS_API_KEY:
        params["key"] = CENSUS_API_KEY

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                if len(data) >= 2:
                    row = data[1]
                    result = {
                        "population": int(row[1]) if row[1] and row[1] != "-666666666" else None,
                        "median_income": float(row[2]) if row[2] and row[2] != "-666666666" else None,
                    }
                    set_cached(cache_key, result)
                    return result
    except Exception as e:
        logger.warning(f"ACS fetch failed for {cbsa}: {e}")

    return {"population": None, "median_income": None}
