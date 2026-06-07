import io
import logging
from typing import Dict, List, Optional
import httpx
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)

ZHVI_URL = "https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
ZORI_URL = "https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrOnly_sm_month.csv"


def _fetch_zillow_csv(url: str, cache_key: str) -> List[dict]:
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                logger.warning(f"Zillow CSV fetch failed: {resp.status_code} {url}")
                return []

        text = resp.text
        lines = text.strip().split("\n")
        if not lines:
            return []

        import csv
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        set_cached(cache_key, rows)
        return rows
    except Exception as e:
        logger.warning(f"Zillow CSV error ({url}): {e}")
        return []


def _match_metro(rows: List[dict], metro_name: str) -> Optional[dict]:
    """Fuzzy match a metro name to a Zillow CSV row by RegionName."""
    # Extract the first city name from metro string like "Austin–Round Rock, TX"
    city = metro_name.split(",")[0].split("–")[0].split("-")[0].strip().lower()
    best = None
    best_score = 0
    for row in rows:
        region = row.get("RegionName", "").lower()
        if city in region:
            score = len(city)
            if score > best_score:
                best_score = score
                best = row
    return best


def _extract_series(row: dict, limit: int = 36) -> List[dict]:
    """Extract monthly date→value pairs from a Zillow CSV row."""
    points = []
    for key, val in row.items():
        if len(key) == 7 and key[4] == "-":  # YYYY-MM format
            try:
                points.append({"date": key, "value": float(val)})
            except (ValueError, TypeError):
                pass
    points.sort(key=lambda x: x["date"])
    return points[-limit:]


def _compute_yoy(series: List[dict]) -> Optional[float]:
    if len(series) < 13:
        return None
    latest = series[-1]["value"]
    year_ago = series[-13]["value"]
    if year_ago == 0:
        return None
    return round((latest - year_ago) / year_ago * 100, 2)


def get_zillow_metrics(metro_name: str) -> Dict:
    zhvi_rows = _fetch_zillow_csv(ZHVI_URL, "zillow_zhvi")
    zori_rows = _fetch_zillow_csv(ZORI_URL, "zillow_zori")

    result: Dict = {
        "home_value": None,
        "home_value_yoy": None,
        "home_value_series": [],
        "rent_index": None,
        "rent_yoy": None,
        "rent_series": [],
    }

    zhvi_row = _match_metro(zhvi_rows, metro_name)
    if zhvi_row:
        series = _extract_series(zhvi_row)
        if series:
            result["home_value"] = series[-1]["value"]
            result["home_value_yoy"] = _compute_yoy(series)
            result["home_value_series"] = series

    zori_row = _match_metro(zori_rows, metro_name)
    if zori_row:
        series = _extract_series(zori_row)
        if series:
            result["rent_index"] = series[-1]["value"]
            result["rent_yoy"] = _compute_yoy(series)
            result["rent_series"] = series

    return result
