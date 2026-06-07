from pydantic import BaseModel
from typing import Optional, List, Dict


class TimePoint(BaseModel):
    date: str
    value: float


class MetroData(BaseModel):
    id: str
    name: str
    state: str
    region: str
    cbsa: str

    permit_growth_yoy: Optional[float] = None
    employment_growth_yoy: Optional[float] = None
    population_growth_yoy: Optional[float] = None

    permit_score: Optional[float] = None
    employment_score: Optional[float] = None
    population_score: Optional[float] = None
    composite_score: Optional[float] = None

    signal: Optional[str] = None  # Hot / Rising / Watch
    deal_signal: bool = False

    permit_series: List[TimePoint] = []
    employment_series: List[TimePoint] = []
    population_series: List[TimePoint] = []

    residential_permits: Optional[float] = None
    commercial_permits: Optional[float] = None
    total_employment: Optional[float] = None
    population: Optional[int] = None
    median_income: Optional[float] = None
    unemployment_rate: Optional[float] = None

    home_value: Optional[float] = None
    home_value_yoy: Optional[float] = None
    rent_index: Optional[float] = None
    rent_yoy: Optional[float] = None
    home_value_series: List[TimePoint] = []
    rent_series: List[TimePoint] = []

    analysis: Optional[Dict] = None


class SummaryData(BaseModel):
    total_markets: int
    hot_markets: int
    avg_permit_growth: float
    avg_employment_growth: float
    last_refreshed: str
