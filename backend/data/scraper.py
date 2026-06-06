import httpx
import logging
import re
from typing import List, Dict
from datetime import datetime
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)

# Direct PDF URLs and index pages confirmed working via research
CITIES = [
    {
        "id": "blairsville_ga",
        "name": "Blairsville, GA",
        "metro_id": None,
        "state": "GA",
        # CivicPlus CMS — /media/<id> pattern serves PDFs directly
        "direct_pdfs": [
            "https://www.blairsville-ga.gov/media/2456",  # Dec 10, 2024
            "https://www.blairsville-ga.gov/media/2326",  # Oct 8, 2024
            "https://www.blairsville-ga.gov/media/2661",  # Sep 2024
        ],
        # Union County (covers surrounding area) — CivicEngage, static HTML
        "index_urls": [
            "https://www.blairsville-ga.gov/citycouncil",
            "https://www.unioncountyga.gov/AgendaCenter/Commission-Meeting-Agendas-3/",
            "https://www.unioncountyga.gov/391/Commission-Meeting-Agendas-Minutes",
        ],
        "union_county_pdfs": [],  # Union County PDFs are encrypted/binary — skipped
    },
    {
        "id": "indianapolis_in",
        "name": "Indianapolis, IN",
        "metro_id": "indianapolis",
        "state": "IN",
        "direct_pdfs": [],
        "index_urls": [
            "https://www.indy.gov/activity/council-meeting-minutes",
            "https://www.indy.gov/activity/agendas-minutes-and-other-resources",
            "https://indianapolis-in.municodemeetings.com/",
        ],
    },
    {
        "id": "nashville_tn",
        "name": "Nashville-Davidson, TN",
        "metro_id": "nashville",
        "state": "TN",
        # Nashville Drupal site serves /sites/default/files/ PDFs as static files
        "direct_pdfs": [
            "https://www.nashville.gov/sites/default/files/2025-01/121224DraftMinutes.pdf",
            "https://www.nashville.gov/sites/default/files/2024-10/092624DraftMinutes.pdf",
            "https://www.nashville.gov/sites/default/files/2024-02/020824DraftMinutes.pdf",
        ],
        "index_urls": [
            "https://www.nashville.gov/departments/metro-clerk/legislative/minutes",
            "https://www.nashville.gov/departments/council/boards/metro-council/meetings",
        ],
    },
]

SIGNAL_KEYWORDS = {
    "major_employer": ["headquarters", "hq", "campus", "facility", "plant", "warehouse",
                       "distribution center", "corporate", "relocat", "employer", "company"],
    "permit_activity": ["building permit", "construction permit", "development permit",
                        "site plan", "rezoning", "rezone", "variance", "subdivision", "zoning"],
    "retail_commercial": ["retail", "shopping center", "restaurant", "hotel", "mixed-use",
                          "commercial development", "grocery", "brewery", "distillery"],
    "infrastructure": ["road improvement", "highway", "interchange", "broadband", "fiber",
                       "water system", "sewer", "infrastructure", "transit", "greenway"],
    "residential": ["housing development", "apartment", "residential", "subdivision",
                    "multifamily", "townhome", "affordable housing", "units"],
    "economic_development": ["incentive", "tax abatement", "TIF", "opportunity zone",
                             "economic development", "job creation", "new jobs", "investment",
                             "grant", "loan"],
    "large_project": ["million", "billion", "square feet", "sq ft", "acres", "phase"],
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        import pypdf
        import io
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages[:15]:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_html(html: str) -> str:
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def find_pdf_links(html: str, base_url: str) -> List[str]:
    from urllib.parse import urlparse, urljoin
    links = []
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    for href in hrefs:
        lower = href.lower()
        if '.pdf' in lower or 'minutes' in lower or 'agenda' in lower:
            full = urljoin(base_url, href)
            if full.startswith('http') and full not in links:
                links.append(full)
    return links[:8]


NAV_PHRASES = [
    "rss notify me", "search agendas by", "time period time period",
    "last week last month", "enter search terms", "save form progress",
    "notify me®", "sign up", "subscribe", "cookie policy",
]


def is_boilerplate(snippet: str) -> bool:
    low = snippet.lower()
    # Skip garbled binary text (high ratio of non-ASCII)
    non_ascii = sum(1 for c in snippet if ord(c) > 127)
    if non_ascii > len(snippet) * 0.12:
        return True
    # Skip obvious website navigation text
    for phrase in NAV_PHRASES:
        if phrase in low:
            return True
    # Skip if same word repeated many times (navigation lists)
    words = low.split()
    if len(words) > 8:
        most_common_count = max(words.count(w) for w in set(words))
        if most_common_count > 5:
            return True
    return False


def extract_full_sentence(text: str, idx: int, kw: str) -> str:
    """Extract a full sentence or two around the keyword match."""
    # Find sentence boundaries
    search_start = max(0, idx - 400)
    search_end = min(len(text), idx + len(kw) + 400)
    region = text[search_start:search_end]

    # Find sentence start (look back for period/newline)
    rel_idx = idx - search_start
    sent_start = rel_idx
    for i in range(rel_idx, max(0, rel_idx - 300), -1):
        if i < len(region) and region[i] in '.!?\n':
            sent_start = i + 1
            break

    # Find sentence end (look forward for period/newline)
    sent_end = min(len(region), rel_idx + len(kw) + 300)
    for i in range(rel_idx + len(kw), min(len(region), rel_idx + len(kw) + 300)):
        if region[i] in '.!?\n':
            sent_end = i + 1
            break

    snippet = region[sent_start:sent_end].strip()
    snippet = re.sub(r'\s+', ' ', snippet)
    # Cap at 600 chars but keep whole words
    if len(snippet) > 600:
        snippet = snippet[:600].rsplit(' ', 1)[0] + '...'
    return snippet


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
                snippet = extract_full_sentence(text, idx, kw)
                key = snippet[:80]
                if key not in seen and len(snippet) > 40 and not is_boilerplate(snippet):
                    seen.add(key)
                    findings.append({
                        "category": category,
                        "category_label": CATEGORY_LABELS[category],
                        "keyword": kw,
                        "snippet": snippet,
                        "source": source,
                    })
                pos = idx + 1
                if len(findings) > 150:
                    break
            if len(findings) > 150:
                break
    return findings


def fetch_and_parse_pdf(client: httpx.Client, url: str) -> tuple[str, bool]:
    """Returns (text, success)."""
    try:
        resp = client.get(url, timeout=25, follow_redirects=True)
        if resp.status_code != 200:
            logger.warning(f"PDF fetch {url} returned {resp.status_code}")
            return "", False
        content_type = resp.headers.get("content-type", "")
        if "pdf" in content_type or url.lower().endswith(".pdf") or len(resp.content) > 5000:
            text = extract_text_from_pdf_bytes(resp.content)
            if text:
                return text, True
        # Try as HTML
        text = extract_text_from_html(resp.text)
        return text, bool(text)
    except Exception as e:
        logger.warning(f"Fetch failed {url}: {e}")
        return "", False


def scrape_city(city: Dict) -> Dict:
    cache_key = f"scrape_{city['id']}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    all_findings = []
    sources_checked = []
    pdfs_found = 0

    with httpx.Client(timeout=20, follow_redirects=True, headers=HEADERS) as client:

        # 1. Try direct known PDF URLs first
        for pdf_url in city.get("direct_pdfs", []):
            text, ok = fetch_and_parse_pdf(client, pdf_url)
            if ok and text:
                pdfs_found += 1
                sources_checked.append(pdf_url)
                findings = scan_for_signals(text, f"PDF: {pdf_url.split('/')[-1]}")
                all_findings.extend(findings)
                logger.info(f"[{city['name']}] Got {len(findings)} signals from {pdf_url.split('/')[-1]}")

        # 2. Also try union county PDFs if present
        for pdf_url in city.get("union_county_pdfs", []):
            text, ok = fetch_and_parse_pdf(client, pdf_url)
            if ok and text:
                pdfs_found += 1
                sources_checked.append(pdf_url)
                findings = scan_for_signals(text, f"PDF: Union County {pdf_url.split('/')[-1]}")
                all_findings.extend(findings)

        # 3. Try index pages — scrape HTML and look for more PDF links
        for url in city.get("index_urls", []):
            try:
                resp = client.get(url, timeout=15)
                if resp.status_code != 200:
                    continue
                sources_checked.append(url)
                html = resp.text

                # Scan page text for signals
                page_text = extract_text_from_html(html)
                if len(page_text) > 200:
                    html_findings = scan_for_signals(page_text, f"Web: {url.split('//')[-1][:40]}")
                    all_findings.extend(html_findings)

                # Find additional PDF links on page
                extra_pdfs = find_pdf_links(html, url)
                for pdf_url in extra_pdfs[:3]:
                    if pdf_url not in sources_checked:
                        text, ok = fetch_and_parse_pdf(client, pdf_url)
                        if ok and text:
                            pdfs_found += 1
                            sources_checked.append(pdf_url)
                            findings = scan_for_signals(text, f"PDF: {pdf_url.split('/')[-1][:40]}")
                            all_findings.extend(findings)

            except Exception as e:
                logger.warning(f"Index scrape failed {url}: {e}")

    # Deduplicate
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
        "findings": unique_findings[:80],
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
            logger.info(f"[{city['name']}] {result['finding_count']} signals, {result['pdfs_found']} PDFs")
        except Exception as e:
            logger.error(f"Failed to scrape {city['name']}: {e}")
            results.append({
                "city_id": city["id"],
                "city_name": city["name"],
                "state": city["state"],
                "status": "error",
                "error": str(e),
                "findings": [],
                "finding_count": 0,
                "pdfs_found": 0,
                "sources_checked": [],
                "categories_found": [],
            })
    return results
