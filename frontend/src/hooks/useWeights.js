import { useState, useCallback } from 'react'

const STORAGE_KEY = 'creditmemo_weights'
const DEFAULTS = { permits: 40, employment: 35, population: 25 }

function loadWeights() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return DEFAULTS
}

export function useWeights() {
  const [weights, setWeightsState] = useState(loadWeights)

  const setWeights = useCallback((next) => {
    setWeightsState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const resetWeights = useCallback(() => setWeights(DEFAULTS), [setWeights])

  return { weights, setWeights, resetWeights, isDefault: weights.permits === DEFAULTS.permits && weights.employment === DEFAULTS.employment && weights.population === DEFAULTS.population }
}

export function applyWeights(markets, weights) {
  if (!markets.length) return markets
  const w = { permits: weights.permits / 100, employment: weights.employment / 100, population: weights.population / 100 }

  const reweighted = markets.map(m => {
    const ps = m.permit_score ?? 0
    const es = m.employment_score ?? 0
    const pops = m.population_score ?? 0
    const score = ps * w.permits + es * w.employment + pops * w.population
    const signal = score >= 75 ? 'Hot' : score >= 50 ? 'Rising' : 'Watch'
    return { ...m, composite_score: Math.round(score * 10) / 10, signal }
  })

  // Recompute deal signal with new weights (still requires all raw metrics positive and above median)
  const permMed = median(reweighted.map(m => m.permit_growth_yoy ?? 0))
  const empMed  = median(reweighted.map(m => m.employment_growth_yoy ?? 0))
  const popMed  = median(reweighted.map(m => m.population_growth_yoy ?? 0))
  return reweighted.map(m => ({
    ...m,
    deal_signal: (m.permit_growth_yoy ?? 0) > 0 && (m.employment_growth_yoy ?? 0) > 0 && (m.population_growth_yoy ?? 0) > 0 &&
                 (m.permit_growth_yoy ?? 0) > permMed && (m.employment_growth_yoy ?? 0) > empMed && (m.population_growth_yoy ?? 0) > popMed,
  }))
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
