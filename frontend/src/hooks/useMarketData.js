import { useState, useEffect, useCallback } from 'react'

const BASE = 'http://localhost:8000/api'

export function useMarketData() {
  const [markets, setMarkets] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [region, setRegion] = useState('All')
  const [lastRefreshed, setLastRefreshed] = useState('')

  const fetchData = useCallback(async (r = region) => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`${BASE}/markets${r && r !== 'All' ? `?region=${encodeURIComponent(r)}` : ''}`),
        fetch(`${BASE}/summary`),
      ])
      if (!mRes.ok || !sRes.ok) throw new Error('API error')
      const [m, s] = await Promise.all([mRes.json(), sRes.json()])
      setMarkets(m)
      setSummary(s)
      setLastRefreshed(s.last_refreshed || new Date().toISOString())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => { fetchData(region) }, [region])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await fetch(`${BASE}/refresh`)
      await fetchData(region)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }, [fetchData, region])

  return { markets, summary, loading, error, region, setRegion, refresh, lastRefreshed }
}
