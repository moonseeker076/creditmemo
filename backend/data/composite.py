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


def compute_trend(series: list) -> str:
    """Compare last 6 months avg vs prior 6 months avg of a time series."""
    if not series or len(series) < 8:
        return "insufficient data"
    sorted_series = sorted(series, key=lambda x: x.get("date", "") if isinstance(x, dict) else x.date)
    recent = sorted_series[-6:]
    prior = sorted_series[-12:-6] if len(sorted_series) >= 12 else sorted_series[:-6]
    if not prior:
        return "insufficient data"
    recent_avg = sum(p.get("value", 0) if isinstance(p, dict) else p.value for p in recent) / len(recent)
    prior_avg = sum(p.get("value", 0) if isinstance(p, dict) else p.value for p in prior) / len(prior)
    if prior_avg == 0:
        return "insufficient data"
    pct_change = (recent_avg - prior_avg) / prior_avg
    if pct_change > 0.05:
        return "accelerating"
    elif pct_change < -0.05:
        return "decelerating"
    return "stable"


def classify_market_pattern(metro, permit_rank: int, emp_rank: int, pop_rank: int, total: int) -> dict:
    """Classify the market into a pattern and return investor implication."""
    third = total / 3
    two_thirds = 2 * total / 3
    half = total / 2

    in_top_third = lambda r: r <= third
    in_mid = lambda r: third < r <= two_thirds
    in_bottom_half = lambda r: r > half

    pg = metro.permit_growth_yoy or 0
    eg = metro.employment_growth_yoy or 0
    ppg = metro.population_growth_yoy or 0

    if in_top_third(emp_rank) and in_top_third(pop_rank) and not in_top_third(permit_rank):
        pattern = "demand_surge"
        label = "Demand Surge"
        implication = "Housing supply is lagging behind population and job growth. Strong acquisition opportunity — rent pressure likely to persist. Multifamily and build-to-rent are primary plays."
    elif in_top_third(permit_rank) and in_top_third(emp_rank):
        pattern = "supply_pull"
        label = "Supply Pull"
        implication = "Developer activity is high and backed by strong job creation. New construction — commercial, industrial, and multifamily — is the primary opportunity. Competition for land and labor will increase."
    elif in_top_third(pop_rank) and in_top_third(permit_rank) and in_mid(emp_rank):
        pattern = "population_play"
        label = "Population Play"
        implication = "Migration is the primary driver. Residential demand is strong and retail follows population. Watch for employment lagging — this market needs job creation to sustain momentum."
    elif in_top_third(emp_rank) and not in_top_third(permit_rank) and not in_top_third(pop_rank):
        pattern = "jobs_led"
        label = "Jobs-Led Growth"
        implication = "Employment is outpacing permits and population — a leading indicator for accelerating development. Watch for permit surge in the next 6–12 months as developers catch up with labor demand."
    elif emp_rank <= half and permit_rank <= half and pop_rank <= half:
        pattern = "broad_momentum"
        label = "Broad Momentum"
        implication = "All three indicators are performing above median. Balanced, lower-risk entry point. No single metric dominates — diversified opportunity across residential, commercial, and industrial."
    else:
        pattern = "watch"
        label = "Mixed Signals"
        implication = "One or more key indicators are underperforming peers. Monitor for trend confirmation before committing capital. Identify which metric is the laggard and track its trajectory."

    peers_outperformed = total - max(permit_rank, emp_rank, pop_rank)

    return {
        "pattern": pattern,
        "pattern_label": label,
        "investor_implication": implication,
        "peer_context": f"Outperforms {peers_outperformed} of {total} tracked metros across key indicators",
    }
