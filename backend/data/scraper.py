import httpx
import logging
import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ─── Permit type classification ───────────────────────────────────────────────
COMMERCIAL_TYPES = {
    "commercial", "industrial", "office", "retail", "hotel", "warehouse",
    "mixed use", "mixed-use", "restaurant", "institutional", "assembly",
    "factory", "manufacturing", "storage", "distribution",
}
RESIDENTIAL_TYPES = {
    "residential", "single family", "multi family", "multifamily",
    "apartment", "townhouse", "townhome", "duplex", "condo",
}


def classify_permit(permit_type: str, work_class: str, description: str) -> str:
    combined = f"{permit_type} {work_class} {description}".lower()
    for t in COMMERCIAL_TYPES:
        if t in combined:
            return "commercial"
    for t in RESIDENTIAL_TYPES:
        if t in combined:
            return "residential"
    return "other"


def fmt_value(val) -> Optional[str]:
    try:
        v = float(val)
        if v <= 0:
            return None
        if v >= 1_000_000:
            return f"${v/1_000_000:.1f}M"
        if v >= 1_000:
            return f"${v/1_000:.0f}K"
        return f"${v:,.0f}"
    except Exception:
        return None


# ─── City configurations for all 24 metros ───────────────────────────────────
# type: "socrata" | "arcgis" | "none"
# Field mappings tell the generic fetcher which API fields map to our schema.
CITY_CONFIGS: Dict[str, Dict] = {
    "nashville": {
        "name": "Nashville–Davidson, TN", "state": "TN",
        "type": "arcgis",
        "url": "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Building_Permits_Issued/FeatureServer/0/query",
        "fields": {"address": "address", "permit_type": "permit_type", "work_class": "work_class",
                   "applicant": "applicant_name", "value": "const_cost", "date": "permit_issued_dt",
                   "permit_number": "permit_number", "description": "description"},
        "date_format": "iso",
        "official_links": [
            {"label": "Nashville Metro Council Minutes", "url": "https://www.nashville.gov/departments/metro-clerk/legislative/minutes"},
            {"label": "Nashville Open Data Permits", "url": "https://data.nashville.gov/Building-Codes-Permits/Building-Permits-Issued/3h5w-q8b7"},
        ],
    },
    "indianapolis": {
        "name": "Indianapolis, IN", "state": "IN",
        "type": "arcgis",
        "url": "https://services6.arcgis.com/ONZht79c8QWuX759/arcgis/rest/services/Building_Permits/FeatureServer/0/query",
        "fields": {"address": "address", "permit_type": "work_type", "applicant": "applicant_name",
                   "value": "declared_value", "date": "issue_date", "permit_number": "permit_num",
                   "description": "description"},
        "date_format": "epoch_ms",
        "official_links": [
            {"label": "Indianapolis City-County Council Minutes", "url": "https://www.indy.gov/activity/council-meeting-minutes"},
            {"label": "Indianapolis Building Permits", "url": "https://www.indy.gov/activity/building-permit-applications"},
        ],
    },
    "austin": {
        "name": "Austin–Round Rock, TX", "state": "TX",
        "type": "socrata",
        "url": "https://data.austintexas.gov/resource/3syk-w9eu.json",
        "fields": {"address": "address", "permit_type": "permit_type_desc", "work_class": "work_class",
                   "applicant": "applicant_company_name", "value": "total_valuation",
                   "date": "issued_date", "permit_number": "permit_num", "description": "description"},
        "official_links": [
            {"label": "Austin City Council", "url": "https://www.austintexas.gov/cityclerk/minutes"},
            {"label": "Austin Permits Open Data", "url": "https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu"},
        ],
    },
    "dallas": {
        "name": "Dallas–Fort Worth, TX", "state": "TX",
        "type": "socrata",
        "url": "https://www.dallasopendata.com/resource/m6e4-hchc.json",
        "fields": {"address": "address", "permit_type": "permit_type", "work_class": "work_class",
                   "value": "declared_valuation", "date": "issue_date", "permit_number": "permit_num",
                   "description": "description"},
        "official_links": [
            {"label": "Dallas City Council Minutes", "url": "https://dallascityhall.com/government/Council/Pages/CityCouncilMinutes.aspx"},
            {"label": "Dallas Building Permits", "url": "https://www.dallasopendata.com/Building-Inspection/Building-Permits/gjzp-s8h2"},
        ],
    },
    "denver": {
        "name": "Denver, CO", "state": "CO",
        "type": "socrata",
        "url": "https://data.denvergov.org/resource/zfh8-bznb.json",
        "fields": {"address": "address", "permit_type": "permit_type_name", "work_class": "work_class_name",
                   "applicant": "applicant_name", "value": "job_value",
                   "date": "issued_date", "permit_number": "permit_no", "description": "description"},
        "official_links": [
            {"label": "Denver City Council Minutes", "url": "https://www.denvergov.org/Government/City-Council/Meeting-Minutes"},
            {"label": "Denver Permits Open Data", "url": "https://opendata-geospatialdenver.hub.arcgis.com/datasets/zfh8bznb"},
        ],
    },
    "raleigh": {
        "name": "Raleigh–Durham, NC", "state": "NC",
        "type": "socrata",
        "url": "https://data.raleighnc.gov/resource/gpby-65dg.json",
        "fields": {"address": "address", "permit_type": "permit_type", "work_class": "work_class",
                   "applicant": "contractor_company_name", "value": "job_value",
                   "date": "issued_date", "permit_number": "permit_num", "description": "description"},
        "official_links": [
            {"label": "Raleigh City Council Minutes", "url": "https://raleighnc.gov/City-Council/Minutes"},
            {"label": "Raleigh Permits Open Data", "url": "https://data.raleighnc.gov/Development/Permits/gpby-65dg"},
        ],
    },
    "charlotte": {
        "name": "Charlotte, NC", "state": "NC",
        "type": "socrata",
        "url": "https://data.charlottenc.gov/resource/c3xk-edgv.json",
        "fields": {"address": "location", "permit_type": "permit_type", "work_class": "work_class",
                   "applicant": "applicant", "value": "job_cost",
                   "date": "issue_date", "permit_number": "permit_number", "description": "description"},
        "official_links": [
            {"label": "Charlotte City Council Minutes", "url": "https://charlottenc.gov/mayorcouncil/minutes"},
            {"label": "Charlotte Permits Open Data", "url": "https://data.charlottenc.gov/d/c3xk-edgv"},
        ],
    },
    # ── Cities without confirmed open data APIs ───────────────────────────────
    "boise": {
        "name": "Boise City, ID", "state": "ID", "type": "none",
        "official_links": [
            {"label": "Boise City Council Minutes", "url": "https://www.cityofboise.org/departments/city-clerk/city-council/minutes-agendas/"},
            {"label": "Boise Open Data Portal", "url": "https://opendata.cityofboise.org/"},
        ],
    },
    "phoenix": {
        "name": "Phoenix–Mesa, AZ", "state": "AZ", "type": "none",
        "official_links": [
            {"label": "Phoenix City Council Minutes", "url": "https://www.phoenix.gov/cityclerk/publicmeetings/council-meetings"},
            {"label": "Phoenix Permits Portal", "url": "https://www.phoenix.gov/pdd/permitting"},
        ],
    },
    "jacksonville": {
        "name": "Jacksonville, FL", "state": "FL", "type": "none",
        "official_links": [
            {"label": "Jacksonville City Council Minutes", "url": "https://www.coj.net/departments/city-council/minutes.aspx"},
            {"label": "Jacksonville Development Services", "url": "https://www.coj.net/departments/planning-and-development"},
        ],
    },
    "columbus": {
        "name": "Columbus, OH", "state": "OH", "type": "none",
        "official_links": [
            {"label": "Columbus City Council Minutes", "url": "https://www.columbus.gov/council/minutes/"},
            {"label": "Columbus Open Data", "url": "https://opendata.columbus.gov/"},
        ],
    },
    "san_antonio": {
        "name": "San Antonio, TX", "state": "TX", "type": "none",
        "official_links": [
            {"label": "San Antonio City Council Minutes", "url": "https://www.sanantonio.gov/Clerk/CouncilMeetingInfo/Agendas-Minutes"},
            {"label": "San Antonio Development", "url": "https://www.sanantonio.gov/DSD"},
        ],
    },
    "atlanta": {
        "name": "Atlanta, GA", "state": "GA", "type": "none",
        "official_links": [
            {"label": "Atlanta City Council Minutes", "url": "https://citycouncil.atlantaga.gov/council-meetings/minutes"},
            {"label": "Atlanta Open Data", "url": "https://opendata.atlantaga.gov/"},
        ],
    },
    "tampa": {
        "name": "Tampa–St. Pete, FL", "state": "FL", "type": "none",
        "official_links": [
            {"label": "Tampa City Council Minutes", "url": "https://www.tampagov.net/city-clerk/meetings-minutes"},
            {"label": "Tampa Permits Portal", "url": "https://permits.tampagov.net/"},
        ],
    },
    "salt_lake": {
        "name": "Salt Lake City, UT", "state": "UT", "type": "none",
        "official_links": [
            {"label": "Salt Lake City Council Minutes", "url": "https://www.slccouncil.com/meeting-minutes"},
            {"label": "SLC Permits Portal", "url": "https://permits.slcgov.com/"},
        ],
    },
    "las_vegas": {
        "name": "Las Vegas, NV", "state": "NV", "type": "none",
        "official_links": [
            {"label": "Las Vegas City Council Minutes", "url": "https://www.lasvegasnevada.gov/Government/Mayor-City-Council/Minutes"},
            {"label": "Clark County Development", "url": "https://www.clarkcountynv.gov/government/departments/building_department"},
        ],
    },
    "orlando": {
        "name": "Orlando, FL", "state": "FL", "type": "none",
        "official_links": [
            {"label": "Orlando City Council Minutes", "url": "https://cityoforlando.net/cityclerk/city-council/minutes/"},
            {"label": "Orlando Permits Portal", "url": "https://cityoforlando.net/building/"},
        ],
    },
    "richmond": {
        "name": "Richmond, VA", "state": "VA", "type": "none",
        "official_links": [
            {"label": "Richmond City Council Minutes", "url": "https://www.rva.gov/city-clerk/city-council-minutes"},
            {"label": "Richmond Permits", "url": "https://www.rva.gov/permits-inspections"},
        ],
    },
    "greenville": {
        "name": "Greenville, SC", "state": "SC", "type": "none",
        "official_links": [
            {"label": "Greenville City Council Minutes", "url": "https://www.greenvillesc.gov/AgendaCenter"},
            {"label": "Greenville Permits", "url": "https://www.greenvillesc.gov/174/Building-Safety"},
        ],
    },
    "huntsville": {
        "name": "Huntsville, AL", "state": "AL", "type": "none",
        "official_links": [
            {"label": "Huntsville City Council Minutes", "url": "https://www.huntsvilleal.gov/government/city-council/meeting-minutes/"},
            {"label": "Huntsville Permits", "url": "https://www.huntsvilleal.gov/development/"},
        ],
    },
    "spokane": {
        "name": "Spokane, WA", "state": "WA", "type": "none",
        "official_links": [
            {"label": "Spokane City Council Minutes", "url": "https://my.spokanecity.org/citycouncil/minutes/"},
            {"label": "Spokane Permits Portal", "url": "https://my.spokanecity.org/bldgsvcs/permits/"},
        ],
    },
    "tucson": {
        "name": "Tucson, AZ", "state": "AZ", "type": "none",
        "official_links": [
            {"label": "Tucson City Council Minutes", "url": "https://www.tucsonaz.gov/Departments/City-Clerk/City-Council/Minutes"},
            {"label": "Tucson Permits Portal", "url": "https://www.tucsonaz.gov/Departments/Planning-and-Development-Services"},
        ],
    },
    "albuquerque": {
        "name": "Albuquerque, NM", "state": "NM", "type": "none",
        "official_links": [
            {"label": "Albuquerque City Council Minutes", "url": "https://www.cabq.gov/council/minutes"},
            {"label": "Albuquerque Permits", "url": "https://www.cabq.gov/planning/building-safety"},
        ],
    },
    "oklahoma_city": {
        "name": "Oklahoma City, OK", "state": "OK", "type": "none",
        "official_links": [
            {"label": "OKC City Council Minutes", "url": "https://www.okc.gov/government/city-council/agendas-minutes"},
            {"label": "OKC Development Services", "url": "https://www.okc.gov/departments/development-services"},
        ],
    },
}


# ─── Generic Socrata fetcher ──────────────────────────────────────────────────

def fetch_socrata_permits(metro_id: str, config: Dict, limit: int = 200) -> List[Dict]:
    cache_key = f"open_data_{metro_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    url = config["url"]
    field_map = config.get("fields", {})
    source_name = f"{config['name']} Open Data"

    findings = []
    params = {"$limit": limit, "$order": f"{field_map.get('date', 'issued_date')} DESC"}

    try:
        with httpx.Client(timeout=20, headers=HEADERS, follow_redirects=True) as client:
            resp = client.get(url, params=params)
            logger.info(f"{metro_id} Socrata: HTTP {resp.status_code}, {len(resp.content)} bytes")
            if resp.status_code == 200:
                rows = resp.json()
                logger.info(f"{metro_id}: {len(rows)} rows")
                for row in rows:
                    finding = _generic_row_to_finding(row, field_map, source_name, "iso")
                    if finding:
                        findings.append(finding)
    except Exception as e:
        logger.warning(f"{metro_id} Socrata fetch failed: {e}")

    set_cached(cache_key, findings)
    return findings


# ─── Generic ArcGIS fetcher ───────────────────────────────────────────────────

def fetch_arcgis_permits(metro_id: str, config: Dict, limit: int = 200) -> List[Dict]:
    cache_key = f"open_data_{metro_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    url = config["url"]
    field_map = config.get("fields", {})
    date_format = config.get("date_format", "iso")
    source_name = f"{config['name']} Open Data"

    findings = []
    params = {"where": "1=1", "outFields": "*", "resultRecordCount": limit,
              "orderByFields": "OBJECTID DESC", "f": "json"}

    try:
        with httpx.Client(timeout=25, headers=HEADERS, follow_redirects=True) as client:
            resp = client.get(url, params=params)
            logger.info(f"{metro_id} ArcGIS: HTTP {resp.status_code}, {len(resp.content)} bytes")
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                logger.info(f"{metro_id}: {len(features)} features")
                for feat in features:
                    attrs = feat.get("attributes", {})
                    finding = _generic_row_to_finding(attrs, field_map, source_name, date_format)
                    if finding:
                        findings.append(finding)
    except Exception as e:
        logger.warning(f"{metro_id} ArcGIS fetch failed: {e}")

    set_cached(cache_key, findings)
    return findings


# ─── Generic row → finding ────────────────────────────────────────────────────

def _generic_row_to_finding(row: dict, field_map: dict, source: str, date_format: str) -> Optional[Dict]:
    def get(mapped_key: str) -> str:
        api_field = field_map.get(mapped_key, mapped_key)
        val = row.get(api_field) or row.get(api_field.upper()) or row.get(api_field.lower())
        return str(val).strip() if val and str(val).strip() not in ("None", "null", "0") else ""

    address     = get("address")
    permit_type = get("permit_type")
    work_class  = get("work_class")
    applicant   = get("applicant")
    description = get("description")
    permit_num  = get("permit_number")
    raw_date    = row.get(field_map.get("date", "issued_date"), "")
    raw_value   = row.get(field_map.get("value", "job_value"), "")

    if not address and not permit_type and not description:
        return None

    category  = classify_permit(permit_type, work_class, description)
    value_str = fmt_value(raw_value) if raw_value else None

    # Date parsing
    date_str = ""
    if raw_date:
        if date_format == "epoch_ms":
            try:
                date_str = datetime.utcfromtimestamp(int(raw_date) / 1000).strftime("%Y-%m-%d")
            except Exception:
                pass
        else:
            date_str = str(raw_date)[:10]

    parts = []
    if applicant:  parts.append(applicant)
    if permit_type: parts.append(permit_type.title())
    if work_class:  parts.append(f"({work_class.title()})")
    if description: parts.append(f"— {description[:100]}")
    if address:     parts.append(f"at {address}")
    if value_str:   parts.append(f"| Value: {value_str}")

    snippet = " ".join(parts) or f"Permit at {address or 'unknown location'}"

    return {
        "category":       "permit_activity" if category == "residential" else "retail_commercial",
        "category_label": "Permit Activity" if category == "residential" else "Commercial Permit",
        "keyword":        permit_type,
        "snippet":        snippet,
        "source":         source,
        "date":           date_str,
        "value":          value_str,
        "address":        address,
        "applicant":      applicant,
        "permit_type":    permit_type,
        "work_class":     work_class,
        "permit_number":  permit_num,
    }


# ─── Blairsville GA (minutes HTML — kept for backward compat) ─────────────────

BLAIRSVILLE_PAGES = [
    "https://www.blairsville-ga.gov/citycouncil",
    "https://www.blairsville-ga.gov/document-library",
    "https://www.unioncountyga.gov/391/Commission-Meeting-Agendas-Minutes",
]
BLAIRSVILLE_CONFIG = {
    "name": "Blairsville, GA", "state": "GA", "type": "none",
    "official_links": [
        {"label": "Blairsville City Council Minutes", "url": "https://www.blairsville-ga.gov/citycouncil"},
        {"label": "Union County Commission Minutes", "url": "https://www.unioncountyga.gov/391/Commission-Meeting-Agendas-Minutes"},
    ],
}

PERMIT_SECTION_MARKERS = [
    "building permit", "site plan", "variance", "rezoning", "rezone",
    "zoning", "conditional use", "special use", "development",
    "approved", "denied", "tabled", "motion",
]


def _is_garbled(text: str) -> bool:
    non_ascii = sum(1 for c in text if ord(c) > 127)
    return non_ascii > len(text) * 0.12 if text else True


def _extract_permit_sentences(text: str) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+|\n', text)
    results = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 20 or _is_garbled(sent):
            continue
        if any(kw in sent.lower() for kw in PERMIT_SECTION_MARKERS):
            results.append(re.sub(r'\s+', ' ', sent)[:500])
    return results


def fetch_blairsville_minutes() -> List[Dict]:
    cache_key = "open_data_blairsville_ga"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    findings = []
    with httpx.Client(timeout=20, follow_redirects=True, headers=HEADERS) as client:
        for url in BLAIRSVILLE_PAGES:
            try:
                resp = client.get(url, timeout=15)
                if resp.status_code != 200:
                    continue
                html = resp.text
                text = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                for sent in _extract_permit_sentences(text)[:20]:
                    findings.append({
                        "category": "permit_activity", "category_label": "Permit Activity",
                        "keyword": "permit", "snippet": sent,
                        "source": f"Blairsville Public Records",
                        "date": "", "value": None, "address": "",
                        "applicant": "", "permit_type": "", "permit_number": "",
                    })
                if findings:
                    break
            except Exception as e:
                logger.warning(f"Blairsville page failed {url}: {e}")

    set_cached(cache_key, findings)
    return findings


# ─── Public entry point ───────────────────────────────────────────────────────

def scrape_metro(metro_id: str) -> Dict:
    """Fetch permit data for a single metro by its market ID."""
    # Blairsville is a special non-market city — handle separately
    if metro_id == "blairsville_ga":
        cfg = BLAIRSVILLE_CONFIG
        try:
            findings = fetch_blairsville_minutes()
        except Exception as e:
            findings = []
            logger.error(f"Blairsville fetch failed: {e}")
        return _build_result(metro_id, cfg, findings)

    cfg = CITY_CONFIGS.get(metro_id)
    if not cfg:
        return _empty_result(metro_id, metro_id.replace("_", " ").title(), "unknown", "no_config")

    source_type = cfg.get("type", "none")
    findings = []

    try:
        if source_type == "socrata":
            findings = fetch_socrata_permits(metro_id, cfg)
        elif source_type == "arcgis":
            findings = fetch_arcgis_permits(metro_id, cfg)
        # "none" → findings stays []
    except Exception as e:
        logger.error(f"Fetch failed for {metro_id}: {e}")

    return _build_result(metro_id, cfg, findings)


def scrape_all_metros() -> List[Dict]:
    """Fetch permit data for all 24 tracked metros + Blairsville."""
    all_ids = list(CITY_CONFIGS.keys()) + ["blairsville_ga"]
    results = []
    for metro_id in all_ids:
        logger.info(f"Fetching intelligence for {metro_id}...")
        result = scrape_metro(metro_id)
        logger.info(f"  → {result['finding_count']} findings, status={result['status']}")
        results.append(result)
    return results


def _build_result(metro_id: str, cfg: Dict, findings: List[Dict]) -> Dict:
    source_type = cfg.get("type", "none")
    has_api = source_type in ("socrata", "arcgis")
    return {
        "city_id":          metro_id,
        "city_name":        cfg.get("name", metro_id),
        "state":            cfg.get("state", ""),
        "scraped_at":       datetime.utcnow().isoformat(),
        "findings":         findings[:80],
        "finding_count":    len(findings),
        "categories_found": list({f["category"] for f in findings}),
        "status":           ("success" if findings else "no_findings") if has_api else "no_data",
        "has_live_data":    has_api,
        "official_links":   cfg.get("official_links", []),
    }


def _empty_result(city_id: str, city_name: str, state: str, reason: str) -> Dict:
    return {
        "city_id": city_id, "city_name": city_name, "state": state,
        "scraped_at": datetime.utcnow().isoformat(),
        "findings": [], "finding_count": 0,
        "categories_found": [], "status": reason,
        "has_live_data": False, "official_links": [],
    }


# ─── Backward-compat aliases (used by main.py imports) ───────────────────────

CITIES = [
    {"id": "blairsville_ga",  "name": "Blairsville, GA",       "metro_id": None,           "state": "GA"},
    {"id": "indianapolis_in", "name": "Indianapolis, IN",       "metro_id": "indianapolis", "state": "IN"},
    {"id": "nashville_tn",    "name": "Nashville-Davidson, TN", "metro_id": "nashville",    "state": "TN"},
]


def scrape_city(city: Dict) -> Dict:
    return scrape_metro(city.get("metro_id") or city["id"])


def scrape_all_cities() -> List[Dict]:
    return scrape_all_metros()
