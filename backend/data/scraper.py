import httpx
import logging
import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)

# ─── Nashville ArcGIS Hub (migrated from Socrata) ────────────────────────────
# Nashville moved from Socrata to ArcGIS Hub. Use BLDS partner portal + ArcGIS Hub GeoJSON
NASHVILLE_BLDS_URL   = "https://permits.partner.socrata.com/resource/7ky7-xbzp.json"
NASHVILLE_ARCGIS_URL = "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Building_Permits_Issued/FeatureServer/0/query"
NASHVILLE_GEOJSON    = "https://opendata.arcgis.com/datasets/2576bfb2d74f418b8ba8c4538e4f729f_0.geojson"

# ─── Indianapolis ArcGIS FeatureServer ───────────────────────────────────────
INDY_PERMITS_URL = (
    "https://services6.arcgis.com/ONZht79c8QWuX759/arcgis/rest"
    "/services/Building_Permits/FeatureServer/0/query"
)

# ─── Blairsville GA — HTML pages (PDFs blocked by server) ────────────────────
BLAIRSVILLE_PAGES = [
    "https://www.blairsville-ga.gov/citycouncil",
    "https://www.blairsville-ga.gov/document-library",
    "https://www.blairsville-ga.gov/meetings",
    "https://www.unioncountyga.gov/391/Commission-Meeting-Agendas-Minutes",
]

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


# ─── Nashville ────────────────────────────────────────────────────────────────

def fetch_nashville_permits(days_back: int = 180) -> List[Dict]:
    cache_key = "open_data_nashville"
    cached = get_cached(cache_key)
    if cached:
        return cached

    findings = []

    # Try 1: BLDS partner Socrata portal (separate from main data.nashville.gov)
    try:
        with httpx.Client(timeout=20, headers=HEADERS, follow_redirects=True) as client:
            resp = client.get(NASHVILLE_BLDS_URL, params={"$limit": 200, "$order": "issued_date DESC"})
            logger.info(f"Nashville BLDS: HTTP {resp.status_code}, {len(resp.content)} bytes")
            if resp.status_code == 200:
                rows = resp.json()
                logger.info(f"Nashville BLDS: {len(rows)} rows, keys: {list(rows[0].keys()) if rows else 'empty'}")
                for row in rows:
                    finding = _nashville_row_to_finding(row, "BLDS Permit")
                    if finding:
                        findings.append(finding)
    except Exception as e:
        logger.warning(f"Nashville BLDS failed: {e}")

    # Try 2: ArcGIS Hub FeatureServer
    if not findings:
        try:
            with httpx.Client(timeout=20, headers=HEADERS, follow_redirects=True) as client:
                params = {"where": "1=1", "outFields": "*", "resultRecordCount": 200,
                          "orderByFields": "OBJECTID DESC", "f": "json"}
                resp = client.get(NASHVILLE_ARCGIS_URL, params=params)
                logger.info(f"Nashville ArcGIS: HTTP {resp.status_code}, {len(resp.content)} bytes, body: {resp.text[:300]}")
                if resp.status_code == 200:
                    data = resp.json()
                    for feat in data.get("features", []):
                        finding = _nashville_row_to_finding(feat.get("attributes", {}), "ArcGIS Permit")
                        if finding:
                            findings.append(finding)
        except Exception as e:
            logger.warning(f"Nashville ArcGIS failed: {e}")

    logger.info(f"Nashville total findings: {len(findings)}")
    set_cached(cache_key, findings)
    return findings


def _nashville_row_to_finding(row: dict, source_type: str) -> Optional[Dict]:
    permit_type  = row.get("permit_type", "")
    work_class   = row.get("work_class", "")
    description  = row.get("description", "") or row.get("permit_subtype", "")
    applicant    = row.get("applicant_name", "") or row.get("owner", "")
    address      = row.get("address", "")
    const_cost   = row.get("const_cost", 0)
    date_raw     = row.get("permit_issued_dt") or row.get("application_date", "")
    permit_num   = row.get("permit_number", "") or row.get("permit_num", "")
    status       = row.get("status", "")

    # Accept rows that have at least an address or permit type
    if not address and not permit_type and not applicant:
        return None

    category = classify_permit(permit_type, work_class, description)
    value_str = fmt_value(const_cost)

    parts = []
    if applicant:
        parts.append(applicant)
    if permit_type:
        parts.append(permit_type.title())
    if work_class:
        parts.append(f"({work_class.title()})")
    if description:
        parts.append(f"— {description[:80]}")
    if address:
        parts.append(f"at {address}")
    if value_str:
        parts.append(f"| Value: {value_str}")
    if status:
        parts.append(f"| Status: {status}")

    snippet = " ".join(parts) or f"Permit at {address or 'unknown location'}"
    date_str = date_raw[:10] if date_raw else ""

    return {
        "category": "permit_activity" if category != "commercial" else "retail_commercial",
        "category_label": "Permit Activity" if category == "residential" else "Commercial Permit",
        "keyword": permit_type,
        "snippet": snippet,
        "source": f"Nashville Open Data — {source_type}",
        "date": date_str,
        "value": value_str,
        "address": address,
        "applicant": applicant,
        "permit_type": permit_type,
        "work_class": work_class,
        "permit_number": permit_num,
    }


# ─── Indianapolis ─────────────────────────────────────────────────────────────

def fetch_indianapolis_permits(days_back: int = 180) -> List[Dict]:
    cache_key = "open_data_indianapolis"
    cached = get_cached(cache_key)
    if cached:
        return cached

    findings = []
    params = {
        "where": "1=1",
        "outFields": "*",
        "resultRecordCount": 200,
        "orderByFields": "OBJECTID DESC",
        "f": "json",
    }
    try:
        with httpx.Client(timeout=25, headers=HEADERS) as client:
            resp = client.get(INDY_PERMITS_URL, params=params)
            logger.info(f"Indianapolis permits: HTTP {resp.status_code}, {len(resp.content)} bytes")
            if resp.status_code == 200:
                data = resp.json()
                # Log full body if empty — helps diagnose ArcGIS errors
                if "error" in data or not data.get("features"):
                    logger.warning(f"Indianapolis full response: {resp.text[:500]}")
                features = data.get("features", [])
                logger.info(f"Indianapolis: got {len(features)} features")
                if features:
                    sample_attrs = features[0].get("attributes", {})
                    logger.info(f"Indianapolis first record keys: {list(sample_attrs.keys())}")
                    logger.info(f"Indianapolis first record: {dict(list(sample_attrs.items())[:8])}")
                for feat in features:
                    attrs = feat.get("attributes", {})
                    finding = _indy_row_to_finding(attrs)
                    if finding:
                        findings.append(finding)
            else:
                logger.warning(f"Indianapolis API error: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Indianapolis permits fetch failed: {e}")

    logger.info(f"Indianapolis total findings: {len(findings)}")
    set_cached(cache_key, findings)
    return findings


def _indy_row_to_finding(attrs: dict) -> Optional[Dict]:
    # Field names vary — try multiple candidates
    def get(*keys):
        for k in keys:
            v = attrs.get(k) or attrs.get(k.upper()) or attrs.get(k.lower())
            if v and str(v).strip() not in ("None", "null", "0"):
                return str(v).strip()
        return ""

    permit_num   = get("permit_num", "PERMIT_NUM", "PermitNumber", "permit_number")
    description  = get("description", "DESCRIPTION", "Description", "work_description")
    address      = get("address", "ADDRESS", "location_address", "street_address")
    street_num   = get("street_num", "STREET_NUM")
    street_name  = get("street_name", "STREET_NAME")
    work_type    = get("work_type", "WORK_TYPE", "WorkType", "permit_type")
    status       = get("status", "STATUS", "Status")
    declared_val = get("declared_value", "DECLARED_VALUE", "const_cost", "job_value")
    applicant    = get("applicant_name", "APPLICANT_NAME", "contractor_name", "owner_name")
    issue_ts     = attrs.get("issue_date") or attrs.get("ISSUE_DATE") or attrs.get("added_date")

    full_address = address or f"{street_num} {street_name}".strip()
    if not full_address and not description and not work_type:
        return None

    value_str = fmt_value(declared_val) if declared_val else None
    category  = classify_permit(work_type, "", description)

    # Parse timestamp (ArcGIS returns epoch ms)
    date_str = ""
    if issue_ts:
        try:
            date_str = datetime.utcfromtimestamp(int(issue_ts) / 1000).strftime("%Y-%m-%d")
        except Exception:
            pass

    parts = []
    if applicant:
        parts.append(applicant)
    if work_type:
        parts.append(work_type.title())
    if description:
        parts.append(f"— {description[:100]}")
    if full_address:
        parts.append(f"at {full_address}")
    if value_str:
        parts.append(f"| Value: {value_str}")
    if status:
        parts.append(f"| {status}")

    snippet = " ".join(parts)
    if not snippet.strip():
        return None

    return {
        "category": "permit_activity" if category == "residential" else "retail_commercial",
        "category_label": "Permit Activity" if category == "residential" else "Commercial Permit",
        "keyword": work_type,
        "snippet": snippet,
        "source": "Indianapolis Open Data",
        "date": date_str,
        "value": value_str,
        "address": full_address,
        "applicant": applicant,
        "permit_type": work_type,
        "permit_number": permit_num,
    }


# ─── Blairsville GA (minutes PDFs) ───────────────────────────────────────────

PERMIT_SECTION_MARKERS = [
    "building permit", "site plan", "variance", "rezoning", "rezone",
    "zoning", "conditional use", "special use", "development",
    "approved", "denied", "tabled", "motion",
]

NAV_PHRASES = [
    "rss notify me", "search agendas by", "time period time period",
    "last week last month", "enter search terms", "save form progress",
    "notify me®", "sign up", "subscribe", "cookie policy",
]


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        import pypdf
        import io
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        return "".join(page.extract_text() or "" for page in reader.pages[:20])
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def is_garbled(text: str) -> bool:
    non_ascii = sum(1 for c in text if ord(c) > 127)
    return non_ascii > len(text) * 0.12 if text else True


def extract_permit_sentences(text: str) -> List[str]:
    """Pull only sentences that contain permit/zoning keywords."""
    sentences = re.split(r'(?<=[.!?])\s+|\n', text)
    results = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 20 or is_garbled(sent):
            continue
        low = sent.lower()
        if any(kw in low for kw in PERMIT_SECTION_MARKERS):
            clean = re.sub(r'\s+', ' ', sent)[:500]
            results.append(clean)
    return results


def fetch_blairsville_minutes() -> List[Dict]:
    cache_key = "open_data_blairsville"
    cached = get_cached(cache_key)
    if cached:
        return cached

    findings = []
    with httpx.Client(timeout=20, follow_redirects=True, headers=HEADERS) as client:
        for url in BLAIRSVILLE_PAGES:
            try:
                resp = client.get(url, timeout=15)
                logger.info(f"Blairsville {url}: HTTP {resp.status_code}, {len(resp.content)} bytes")
                if resp.status_code != 200:
                    continue
                # Strip HTML tags and extract readable text
                html = resp.text
                text = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                logger.info(f"Blairsville extracted {len(text)} chars of text")
                sentences = extract_permit_sentences(text)
                logger.info(f"Blairsville permit sentences: {len(sentences)}")
                for sent in sentences[:20]:
                    findings.append({
                        "category": "permit_activity",
                        "category_label": "Permit Activity",
                        "keyword": "permit",
                        "snippet": sent,
                        "source": f"Blairsville Public Records — {url.split('/')[-1]}",
                        "date": "", "value": None, "address": "",
                        "applicant": "", "permit_type": "", "permit_number": "",
                    })
                if findings:
                    break
            except Exception as e:
                logger.warning(f"Blairsville page failed {url}: {e}")

    set_cached(cache_key, findings)
    return findings


# ─── Public entry points ──────────────────────────────────────────────────────

CITIES = [
    {"id": "blairsville_ga",   "name": "Blairsville, GA",       "metro_id": None,            "state": "GA"},
    {"id": "indianapolis_in",  "name": "Indianapolis, IN",       "metro_id": "indianapolis",  "state": "IN"},
    {"id": "nashville_tn",     "name": "Nashville-Davidson, TN", "metro_id": "nashville",     "state": "TN"},
]

_FETCHERS = {
    "blairsville_ga":  fetch_blairsville_minutes,
    "indianapolis_in": fetch_indianapolis_permits,
    "nashville_tn":    fetch_nashville_permits,
}


def scrape_city(city: Dict) -> Dict:
    fetcher = _FETCHERS.get(city["id"])
    if not fetcher:
        return _empty(city, "no_fetcher")

    try:
        findings = fetcher()
    except Exception as e:
        logger.error(f"Fetcher failed for {city['name']}: {e}")
        return _empty(city, f"error: {e}")

    return {
        "city_id":         city["id"],
        "city_name":       city["name"],
        "metro_id":        city.get("metro_id"),
        "state":           city["state"],
        "scraped_at":      datetime.utcnow().isoformat(),
        "sources_checked": [city["id"]],
        "pdfs_found":      0,
        "findings":        findings[:80],
        "finding_count":   len(findings),
        "categories_found": list({f["category"] for f in findings}),
        "status":          "success" if findings else "no_findings",
    }


def scrape_all_cities() -> List[Dict]:
    results = []
    for city in CITIES:
        logger.info(f"Fetching {city['name']}...")
        results.append(scrape_city(city))
        logger.info(f"  → {results[-1]['finding_count']} findings")
    return results


def _empty(city: Dict, reason: str) -> Dict:
    return {
        "city_id":         city["id"],
        "city_name":       city["name"],
        "state":           city["state"],
        "status":          reason,
        "findings":        [],
        "finding_count":   0,
        "pdfs_found":      0,
        "sources_checked": [],
        "categories_found": [],
        "scraped_at":      datetime.utcnow().isoformat(),
    }
