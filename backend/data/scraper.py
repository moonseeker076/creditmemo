import httpx
import logging
import re
from typing import List, Dict, Optional
from datetime import datetime
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)

CITIES = [
    {"id": "blairsville_ga", "name": "Blairsville, GA", "metro_id": None,
     "urls": [
         "https://www.blairsvillega.com/city-council",
         "https://www.blairsvillega.com/minutes",
         "https://www.unioncountyga.gov/government/commissioners",
         "https://www.unioncountyga.gov/minutes",
     ], "state": "GA"},
    {"id": "indianapolis_in", "name": "Indianapolis, IN", "metro_id": "indianapolis",
     "urls": [
         "https://www.indy.gov/agency/city-county-council",
         "https://council.indy.gov/",
     ], "state": "IN"},
    {"id": "nashville_tn", "name": "Nashville-Davidson, TN", "metro_id": "nashville",
     "urls": [
         "https://www.nashville.gov/departments/metropolitan-clerk/metro-council",
         "https://www.nashville.gov/government/metro-council",
     ], "state": "TN"},
]

SIGNAL_KEYWORDS = {
    "major_employer": ["headquarters", "hq", "campus", "facility", "plant", "warehouse", "distribution center", "corporate", "relocat", "employer"],
    "permit_activity": ["building permit", "construction permit", "development permit", "site plan", "rezoning", "rezone", "variance", "subdivision", "zoning"],
    "retail_commercial": ["retail", "shopping center", "restaurant", "hotel", "mixed-use", "commercial development", "grocery"],
    "infrastructure": ["road improvement", "highway", "interchange", "broadband", "fiber", "water system", "sewer", "infrastructure"],
    "residential": ["housing development", "apartment", "residential", "subdivision", "multifamily", "townhome", "affordable housing"],
    "economic_development": ["incentive", "tax abatement", "TIF district", "opportunity zone", "economic development", "job creation", "new jobs", "investment"],
    "large_project": ["million dollar", "billion", "square feet", "sq ft", "acres"],
}

CATEGORY_LABELS = {
    "major_employer": "Major Employer",
    "permit_activity": "Permit Activity",
    "retail_commercial": "Retail & Commercial",
    "infrastructure": "Infrastructure",
    "residential": "Residential Development",
    "economic_development": "Economic Development",
    "large_project": "Large Project",
}


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        import pypdf
        import io
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages[:10]:  # limit to 10 pages
            text += page.extract_text() or ""
        return text
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_html(html: str) -> str:
    # Strip tags
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text)
    return text


def find_pdf_links(html: str, base_url: str) -> List[str]:
    links = []
    # Find all href attributes
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    for href in hrefs:
        if href.lower().endswith('.pdf') or ('minutes' in href.lower() and '.pdf' in href.lower()):
            if href.startswith('http'):
                links.append(href)
            elif href.startswith('/'):
                from urllib.parse import urlparse
                parsed = urlparse(base_url)
                links.append(f"{parsed.scheme}://{parsed.netloc}{href}")
    return links[:5]  # max 5 PDFs


def scan_for_signals(text: str, source: str) -> List[Dict]:
    findings = []
    text_lower = text.lower()
    seen = set()

    for category, keywords in SIGNAL_KEYWORDS.items():
        for kw in keywords:
            pos = 0
            while True:
                idx = text_lower.find(kw.lower(), pos)
                if idx == -1:
                    break
                # Extract surrounding context
                start = max(0, idx - 120)
                end = min(len(text), idx + len(kw) + 120)
                snippet = text[start:end].strip().replace('\n', ' ')
                snippet = re.sub(r'\s+', ' ', snippet)

                key = snippet[:60]
                if key not in seen and len(snippet) > 20:
                    seen.add(key)
                    findings.append({
                        "category": category,
                        "category_label": CATEGORY_LABELS[category],
                        "keyword": kw,
                        "snippet": snippet,
                        "source": source,
                    })
                pos = idx + 1
                if len(findings) > 50:  # cap per city
                    break
            if len(findings) > 50:
                break

    return findings


def scrape_city(city: Dict) -> Dict:
    cache_key = f"scrape_{city['id']}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    all_findings = []
    sources_checked = []
    pdfs_found = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; RealEstateResearchBot/1.0; +public-records-research)"
    }

    for url in city["urls"]:
        try:
            with httpx.Client(timeout=15, follow_redirects=True) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code != 200:
                    continue

                html = resp.text
                sources_checked.append(url)

                # Try to find and parse PDFs
                pdf_links = find_pdf_links(html, url)
                for pdf_url in pdf_links[:3]:
                    try:
                        pdf_resp = client.get(pdf_url, headers=headers, timeout=20)
                        if pdf_resp.status_code == 200:
                            text = extract_text_from_pdf_bytes(pdf_resp.content)
                            if text:
                                pdfs_found += 1
                                findings = scan_for_signals(text, f"PDF: {pdf_url.split('/')[-1]}")
                                all_findings.extend(findings)
                    except Exception as e:
                        logger.warning(f"PDF download failed {pdf_url}: {e}")

                # Also scan the HTML page itself
                page_text = extract_text_from_html(html)
                html_findings = scan_for_signals(page_text, f"Web: {url}")
                all_findings.extend(html_findings)

                if all_findings:
                    break  # found data, stop trying URLs

        except Exception as e:
            logger.warning(f"Scrape failed for {city['name']} at {url}: {e}")

    # Deduplicate and limit
    seen_snippets = set()
    unique_findings = []
    for f in all_findings:
        key = f["snippet"][:80]
        if key not in seen_snippets:
            seen_snippets.add(key)
            unique_findings.append(f)

    result = {
        "city_id": city["id"],
        "city_name": city["name"],
        "metro_id": city.get("metro_id"),
        "state": city["state"],
        "scraped_at": datetime.utcnow().isoformat(),
        "sources_checked": sources_checked,
        "pdfs_found": pdfs_found,
        "findings": unique_findings[:30],
        "finding_count": len(unique_findings),
        "categories_found": list(set(f["category"] for f in unique_findings)),
        "status": "success" if unique_findings else "no_findings",
    }

    set_cached(cache_key, result)
    return result


def scrape_all_cities() -> List[Dict]:
    results = []
    for city in CITIES:
        try:
            logger.info(f"Scraping {city['name']}...")
            result = scrape_city(city)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to scrape {city['name']}: {e}")
            results.append({
                "city_id": city["id"],
                "city_name": city["name"],
                "state": city["state"],
                "status": "error",
                "error": str(e),
                "findings": [],
            })
    return results
