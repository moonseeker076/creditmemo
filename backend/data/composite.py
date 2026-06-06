from typing import List, Optional
from .models import MetroData
import statistics


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 50.0
    return max(0.0, min(100.0, (value - min_val) / (max_val - min_val) * 100))


def compute_scores(metros: List[MetroData]) -> List[MetroData]:
    permit_vals = [m.permit_growth_yoy for m in metros if m.permit_growth_yoy is not None]
    emp_vals = [m.employment_growth_yoy for m in metros if m.employment_growth_yoy is not None]
    pop_vals = [m.population_growth_yoy for m in metros if m.population_growth_yoy is not None]

    permit_min = min(permit_vals) if permit_vals else 0
    permit_max = max(permit_vals) if permit_vals else 100
    emp_min = min(emp_vals) if emp_vals else 0
    emp_max = max(emp_vals) if emp_vals else 100
    pop_min = min(pop_vals) if pop_vals else 0
    pop_max = max(pop_vals) if pop_vals else 100

    permit_median = statistics.median(permit_vals) if permit_vals else 0
    emp_median = statistics.median(emp_vals) if emp_vals else 0
    pop_median = statistics.median(pop_vals) if pop_vals else 0

    for metro in metros:
        pg = metro.permit_growth_yoy
        eg = metro.employment_growth_yoy
        ppg = metro.population_growth_yoy

        ps = normalize(pg, permit_min, permit_max) if pg is not None else 50.0
        es = normalize(eg, emp_min, emp_max) if eg is not None else 50.0
        pps = normalize(ppg, pop_min, pop_max) if ppg is not None else 50.0

        metro.permit_score = round(ps, 1)
        metro.employment_score = round(es, 1)
        metro.population_score = round(pps, 1)

        composite = ps * 0.40 + es * 0.35 + pps * 0.25
        metro.composite_score = round(composite, 1)

        if composite >= 75:
            metro.signal = "Hot"
        elif composite >= 50:
            metro.signal = "Rising"
        else:
            metro.signal = "Watch"

        metro.deal_signal = (
            pg is not None and eg is not None and ppg is not None
            and pg > 0 and eg > 0 and ppg > 0
            and pg > permit_median and eg > emp_median and ppg > pop_median
        )

    return metros
