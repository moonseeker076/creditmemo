# Real Estate Market Intelligence Dashboard

A full-stack real estate market intelligence dashboard tracking 24 high-growth US metros with permit activity, employment trends, and population growth signals.

## Getting API Keys

All three API keys are free:

1. **Census API Key** — Sign up at https://api.census.gov/data/key_signup.html (instant email delivery)
2. **BLS API Key** — Register at https://data.bls.gov/registrationEngine/ (instant)
3. **FRED API Key** — Create account at https://fred.stlouisfed.org/docs/api/api_key.html (instant)

## Setup

Copy the example env file and fill in your keys:

```bash
cp .env.example backend/.env
# Edit backend/.env with your actual API keys
```

## Running the Backend

```bash
cd backend
pip install -r requirements.txt

# Live data mode (fetches from Census BPS, BLS, ACS APIs):
uvicorn main:app --reload

# Seed/demo mode (realistic mock data, no API keys needed):
uvicorn main:app --reload -- --seed
```

The API will be available at http://localhost:8000

API endpoints:
- `GET /api/markets` — All markets sorted by composite score
- `GET /api/markets?region=Southeast` — Filter by region
- `GET /api/markets/{metro_id}` — Single metro detail
- `GET /api/summary` — Aggregate summary stats
- `GET /api/refresh` — Force cache clear and re-fetch

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at http://localhost:5173

The Vite dev server proxies `/api` requests to `http://localhost:8000`, so both services need to be running.

## Adding a New Metro

1. Add an entry to the `METROS` list in `backend/main.py`:

```python
{
    "id": "my_city",
    "name": "My City, ST",
    "cbsa": "12345",           # Find at https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html
    "bls_series": "LAUMT...",  # BLS Metro area unemployment series ID
    "state": "ST",
    "region": "Region Name",   # South / Southeast / Mountain West / Midwest / Southwest / Northeast
}
```

2. The metro will automatically appear in the dashboard on next startup.

## How the Composite Score Works

Each metro gets a score from 0–100 based on three normalized indicators:

| Indicator | Weight | Source |
|-----------|--------|--------|
| Building Permit Growth (YoY) | 40% | Census Bureau BPS |
| Employment Growth (YoY) | 35% | Bureau of Labor Statistics |
| Population Growth (YoY) | 25% | Census ACS / FRED |

Each raw growth value is min-max normalized across all tracked metros (0 = lowest, 100 = highest).

**Signals:**
- **Hot** — Composite score ≥ 75
- **Rising** — Composite score 50–74
- **Watch** — Composite score < 50

**Deal Signal** — A metro gets a deal signal badge when ALL three indicators are simultaneously positive AND above their respective medians across all tracked markets.
