import httpx
import logging
from typing import Dict, List, Optional
from .cache import get_cached, set_cached
import os
from datetime import datetime

logger = logging.getLogger(__name__)

BLS_API_KEY = os.getenv("BLS_API_KEY", "")
BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"


def fetch_employment_series(series_id: str, years: int = 3) -> Dict:
    cache_key = f"bls_{series_id}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    now = datetime.utcnow()
    start_year = now.year - years
    end_year = now.year

    payload = {
        "seriesid": [series_id],
        "startyear": str(start_year),
        "endyear": str(end_year),
    }
    if BLS_API_KEY:
        payload["registrationkey"] = BLS_API_KEY

    try:
        with httpx.Client(timeout=20) as client:
            resp = client.post(BLS_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "REQUEST_SUCCEEDED":
                    series_data = data["Results"]["series"][0]["data"]
                    points = []
                    for item in series_data:
                        if item["period"].startswith("M") and item["period"] != "M13":
                            month = int(item["period"][1:])
                            date_str = f"{item['year']}-{month:02d}"
                            try:
                                points.append({"date": date_str, "value": float(item["value"].replace(",", ""))})
                            except ValueError:
                                pass
                    points.sort(key=lambda x: x["date"])
                    result = {"series_id": series_id, "series": points}
                    set_cached(cache_key, result)
                    return result
    except Exception as e:
        logger.warning(f"BLS fetch failed for {series_id}: {e}")

    return {"series_id": series_id, "series": []}


def fetch_unemployment_rate(series_id: str) -> Optional[float]:
    """Fetch latest unemployment rate from BLS LAUMT...000000003 series."""
    unemp_series_id = series_id.replace("000000006", "000000003")
    cache_key = f"bls_{unemp_series_id}"
    cached = get_cached(cache_key)
    if cached:
        pts = cached.get("series", [])
        return pts[-1]["value"] if pts else None

    now = datetime.utcnow()
    payload = {
        "seriesid": [unemp_series_id],
        "startyear": str(now.year - 1),
        "endyear": str(now.year),
    }
    if BLS_API_KEY:
        payload["registrationkey"] = BLS_API_KEY

    try:
        with httpx.Client(timeout=20) as client:
            resp = client.post(BLS_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "REQUEST_SUCCEEDED":
                    series_data = data["Results"]["series"][0]["data"]
                    points = []
                    for item in series_data:
                        if item["period"].startswith("M") and item["period"] != "M13":
                            month = int(item["period"][1:])
                            date_str = f"{item['year']}-{month:02d}"
                            try:
                                points.append({"date": date_str, "value": float(item["value"].replace(",", ""))})
                            except ValueError:
                                pass
                    points.sort(key=lambda x: x["date"])
                    result = {"series_id": unemp_series_id, "series": points}
                    set_cached(cache_key, result)
                    return points[-1]["value"] if points else None
    except Exception as e:
        logger.warning(f"BLS unemployment fetch failed for {unemp_series_id}: {e}")
    return None


def compute_employment_growth(series_data: Dict) -> Optional[float]:
    pts = series_data.get("series", [])
    if len(pts) < 13:
        return None
    latest = pts[-1]["value"]
    year_ago = pts[-13]["value"]
    if year_ago == 0:
        return None
    return round((latest - year_ago) / year_ago * 100, 2)
