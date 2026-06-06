import os
import sys
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from data.models import MetroData, SummaryData
from data.cache import get_cached, set_cached, clear_cache, CACHE_DIR
from data.scraper import scrape_all_cities, scrape_city, CITIES as SCRAPER_CITIES
from data.census import fetch_permits_for_metro, compute_permit_growth, fetch_acs_data
from data.bls import fetch_employment_series, compute_employment_growth
from data.composite import compute_scores

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SEED_MODE = "--seed" in sys.argv or os.getenv("SEED_MODE", "").lower() in ("1", "true", "yes")

METROS = [
    {"id": "austin", "name": "Austin–Round Rock, TX", "cbsa": "12420", "bls_series": "LAUMT122420000000006", "state": "TX", "region": "South"},
    {"id": "nashville", "name": "Nashville–Davidson, TN", "cbsa": "34980", "bls_series": "LAUMT183498000000006", "state": "TN", "region": "Southeast"},
    {"id": "boise", "name": "Boise City, ID", "cbsa": "14260", "bls_series": "LAUMT141426000000006", "state": "ID", "region": "Mountain West"},
    {"id": "raleigh", "name": "Raleigh–Durham, NC", "cbsa": "39580", "bls_series": "LAUMT193958000000006", "state": "NC", "region": "Southeast"},
    {"id": "phoenix", "name": "Phoenix–Mesa, AZ", "cbsa": "38060", "bls_series": "LAUMT043806000000006", "state": "AZ", "region": "Southwest"},
    {"id": "charlotte", "name": "Charlotte, NC", "cbsa": "16740", "bls_series": "LAUMT161674000000006", "state": "NC", "region": "Southeast"},
    {"id": "jacksonville", "name": "Jacksonville, FL", "cbsa": "27260", "bls_series": "LAUMT122726000000006", "state": "FL", "region": "Southeast"},
    {"id": "columbus", "name": "Columbus, OH", "cbsa": "18140", "bls_series": "LAUMT391814000000006", "state": "OH", "region": "Midwest"},
    {"id": "indianapolis", "name": "Indianapolis, IN", "cbsa": "26900", "bls_series": "LAUMT182690000000006", "state": "IN", "region": "Midwest"},
    {"id": "san_antonio", "name": "San Antonio, TX", "cbsa": "41700", "bls_series": "LAUMT484170000000006", "state": "TX", "region": "South"},
    {"id": "dallas", "name": "Dallas–Fort Worth, TX", "cbsa": "19100", "bls_series": "LAUMT481910000000006", "state": "TX", "region": "South"},
    {"id": "atlanta", "name": "Atlanta, GA", "cbsa": "12060", "bls_series": "LAUMT131206000000006", "state": "GA", "region": "Southeast"},
    {"id": "tampa", "name": "Tampa–St. Pete, FL", "cbsa": "45300", "bls_series": "LAUMT124530000000006", "state": "FL", "region": "Southeast"},
    {"id": "denver", "name": "Denver, CO", "cbsa": "19740", "bls_series": "LAUMT081974000000006", "state": "CO", "region": "Mountain West"},
    {"id": "salt_lake", "name": "Salt Lake City, UT", "cbsa": "41620", "bls_series": "LAUMT494162000000006", "state": "UT", "region": "Mountain West"},
    {"id": "las_vegas", "name": "Las Vegas, NV", "cbsa": "29820", "bls_series": "LAUMT322982000000006", "state": "NV", "region": "Mountain West"},
    {"id": "orlando", "name": "Orlando, FL", "cbsa": "36740", "bls_series": "LAUMT123674000000006", "state": "FL", "region": "Southeast"},
    {"id": "richmond", "name": "Richmond, VA", "cbsa": "40060", "bls_series": "LAUMT514006000000006", "state": "VA", "region": "Southeast"},
    {"id": "greenville", "name": "Greenville, SC", "cbsa": "24860", "bls_series": "LAUMT452486000000006", "state": "SC", "region": "Southeast"},
    {"id": "huntsville", "name": "Huntsville, AL", "cbsa": "26620", "bls_series": "LAUMT012662000000006", "state": "AL", "region": "Southeast"},
    {"id": "spokane", "name": "Spokane, WA", "cbsa": "44060", "bls_series": "LAUMT534406000000006", "state": "WA", "region": "Mountain West"},
    {"id": "tucson", "name": "Tucson, AZ", "cbsa": "46060", "bls_series": "LAUMT044606000000006", "state": "AZ", "region": "Southwest"},
    {"id": "albuquerque", "name": "Albuquerque, NM", "cbsa": "10740", "bls_series": "LAUMT351074000000006", "state": "NM", "region": "Southwest"},
    {"id": "oklahoma_city", "name": "Oklahoma City, OK", "cbsa": "36420", "bls_series": "LAUMT403642000000006", "state": "OK", "region": "South"},
]

import random

def generate_seed_data() -> List[MetroData]:
    """Generate realistic mock data for frontend development."""
    random.seed(42)
    metros = []
    for m in METROS:
        pg = round(random.uniform(-5, 35), 2)
        eg = round(random.uniform(-1, 8), 2)
        ppg = round(random.uniform(-0.5, 3.5), 2)

        res_series = []
        com_series = []
        emp_series = []
        pop_series = []

        base_res = random.randint(200, 2000)
        base_emp = random.randint(400000, 2000000)

        for i in range(24):
            from datetime import datetime, timedelta
            dt = datetime(2024, 1, 1) - timedelta(days=30 * (23 - i))
            date_str = dt.strftime("%Y-%m")
            res_series.append({"date": date_str, "value": round(base_res * (1 + random.uniform(-0.15, 0.25)), 0)})
            com_series.append({"date": date_str, "value": round(base_res * 0.3 * (1 + random.uniform(-0.1, 0.2)), 0)})
            emp_series.append({"date": date_str, "value": round(base_emp * (1 + random.uniform(-0.01, 0.015)), 0)})
            pop_series.append({"date": date_str, "value": round(random.randint(500000, 3000000) * (1 + ppg / 100 * i / 24), 0)})

        metro = MetroData(
            id=m["id"],
            name=m["name"],
            state=m["state"],
            region=m["region"],
            cbsa=m["cbsa"],
            permit_growth_yoy=pg,
            employment_growth_yoy=eg,
            population_growth_yoy=ppg,
            permit_series=[{"date": p["date"], "value": p["value"]} for p in res_series],
            employment_series=[{"date": p["date"], "value": p["value"]} for p in emp_series],
            population_series=[{"date": p["date"], "value": p["value"]} for p in pop_series],
            residential_permits=res_series[-1]["value"] if res_series else None,
            commercial_permits=com_series[-1]["value"] if com_series else None,
            total_employment=emp_series[-1]["value"] if emp_series else None,
            population=random.randint(500000, 7000000),
            median_income=random.randint(45000, 95000),
        )
        metros.append(metro)

    return compute_scores(metros)


async def refresh_all_data() -> List[MetroData]:
    if SEED_MODE:
        return generate_seed_data()

    cached = get_cached("all_markets")
    if cached:
        return [MetroData(**m) for m in cached]

    metros = []
    for m in METROS:
        try:
            permit_data = fetch_permits_for_metro(m["cbsa"])
            pg = compute_permit_growth(permit_data)

            emp_data = fetch_employment_series(m["bls_series"])
            eg = compute_employment_growth(emp_data)

            acs = fetch_acs_data(m["cbsa"])

            res_series = permit_data.get("residential_series", [])
            com_series = permit_data.get("commercial_series", [])
            emp_series = emp_data.get("series", [])

            metro = MetroData(
                id=m["id"],
                name=m["name"],
                state=m["state"],
                region=m["region"],
                cbsa=m["cbsa"],
                permit_growth_yoy=pg,
                employment_growth_yoy=eg,
                population_growth_yoy=None,
                permit_series=[{"date": p["date"], "value": p["value"]} for p in res_series],
                employment_series=[{"date": p["date"], "value": p["value"]} for p in emp_series],
                population_series=[],
                residential_permits=res_series[-1]["value"] if res_series else None,
                commercial_permits=com_series[-1]["value"] if com_series else None,
                total_employment=emp_series[-1]["value"] if emp_series else None,
                population=acs.get("population"),
                median_income=acs.get("median_income"),
            )
            metros.append(metro)
        except Exception as e:
            logger.error(f"Failed to fetch data for {m['name']}: {e}")

    metros = compute_scores(metros)
    set_cached("all_markets", [m.model_dump() for m in metros])
    return metros


app = FastAPI(title="Real Estate Market Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_markets_cache: List[MetroData] = []
_last_refreshed: str = ""


@app.on_event("startup")
async def startup():
    global _markets_cache, _last_refreshed
    _markets_cache = await refresh_all_data()
    _last_refreshed = datetime.utcnow().isoformat()


@app.get("/api/markets")
async def get_markets(region: Optional[str] = Query(None)):
    data = _markets_cache
    if region and region != "All":
        data = [m for m in data if m.region == region]
    data = sorted(data, key=lambda x: x.composite_score or 0, reverse=True)
    return [m.model_dump() for m in data]


@app.get("/api/markets/{metro_id}")
async def get_market(metro_id: str):
    for m in _markets_cache:
        if m.id == metro_id:
            return m.model_dump()
    return {"error": "Metro not found"}, 404


@app.get("/api/summary")
async def get_summary():
    data = _markets_cache
    hot = [m for m in data if m.signal == "Hot"]
    permit_growths = [m.permit_growth_yoy for m in data if m.permit_growth_yoy is not None]
    emp_growths = [m.employment_growth_yoy for m in data if m.employment_growth_yoy is not None]

    top10 = sorted(data, key=lambda x: x.composite_score or 0, reverse=True)[:10]
    top10_permits = [m.permit_growth_yoy for m in top10 if m.permit_growth_yoy is not None]

    return SummaryData(
        total_markets=len(data),
        hot_markets=len(hot),
        avg_permit_growth=round(sum(top10_permits) / len(top10_permits), 1) if top10_permits else 0,
        avg_employment_growth=round(sum(emp_growths) / len(emp_growths), 1) if emp_growths else 0,
        last_refreshed=_last_refreshed,
    ).model_dump()


@app.get("/api/refresh")
async def manual_refresh():
    global _markets_cache, _last_refreshed
    clear_cache()
    _markets_cache = await refresh_all_data()
    _last_refreshed = datetime.utcnow().isoformat()
    return {"status": "refreshed", "last_refreshed": _last_refreshed, "markets": len(_markets_cache)}


_intelligence_cache: List[Dict] = []
_intelligence_refreshed: str = ""


@app.get("/api/intelligence")
async def get_intelligence():
    global _intelligence_cache, _intelligence_refreshed
    if not _intelligence_cache:
        _intelligence_cache = scrape_all_cities()
        _intelligence_refreshed = datetime.utcnow().isoformat()
    return {"cities": _intelligence_cache, "last_refreshed": _intelligence_refreshed}


@app.get("/api/intelligence/refresh")
async def refresh_intelligence():
    global _intelligence_cache, _intelligence_refreshed
    for f in CACHE_DIR.glob("scrape_*.json"):
        f.unlink()
    _intelligence_cache = scrape_all_cities()
    _intelligence_refreshed = datetime.utcnow().isoformat()
    return {"status": "refreshed", "cities": len(_intelligence_cache)}


@app.get("/api/intelligence/{city_id}")
async def get_city_intelligence(city_id: str):
    city = next((c for c in SCRAPER_CITIES if c["id"] == city_id), None)
    if not city:
        return {"error": "City not found"}
    result = scrape_city(city)
    return result
