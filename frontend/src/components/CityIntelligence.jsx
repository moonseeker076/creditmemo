import { useState, useEffect } from 'react'

const CATEGORY_COLORS = {
  major_employer: '#1D9E75',
  permit_activity: '#378ADD',
  retail_commercial: '#7F77DD',
  infrastructure: '#BA7517',
  residential: '#D85A30',
  economic_development: '#1D9E75',
  large_project: '#D85A30',
}

const CATEGORY_ICONS = {
  major_employer: '🏢',
  permit_activity: '🏗️',
  retail_commercial: '🛍️',
  infrastructure: '🛣️',
  residential: '🏘️',
  economic_development: '💼',
  large_project: '💰',
}

export default function CityIntelligence({ theme }) {
  const isDark = theme === 'dark'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    fetch('http://localhost:8000/api/intelligence')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const bg = isDark ? '#1A1D2E' : '#F7F7F7'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const subTxt = '#888'

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: subTxt }}>
      ⏳ Scraping city council records... this may take 30-60 seconds...
    </div>
  )

  if (error) return (
    <div style={{ padding: 20, color: '#D85A30' }}>Error loading intelligence: {error}</div>
  )

  const cities = data?.cities || []
  const currentCity = selectedCity ? cities.find(c => c.city_id === selectedCity) : cities[0]
  const findings = currentCity?.findings || []
  const filtered = activeCategory === 'all' ? findings : findings.filter(f => f.category === activeCategory)
  const categories = [...new Set(findings.map(f => f.category))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: txt, fontSize: 15, fontWeight: 700 }}>🏛️ City Intelligence Feed — Public Records</h3>
        <span style={{ fontSize: 12, color: subTxt }}>
          {data?.last_refreshed ? `Scraped ${new Date(data.last_refreshed).toLocaleString()}` : ''}
        </span>
      </div>

      {/* City tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {cities.map(city => (
          <button
            key={city.city_id}
            onClick={() => { setSelectedCity(city.city_id); setActiveCategory('all') }}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: (selectedCity || cities[0]?.city_id) === city.city_id ? '#378ADD' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              color: (selectedCity || cities[0]?.city_id) === city.city_id ? '#fff' : isDark ? '#C0C0C0' : '#444',
            }}
          >
            {city.city_name}
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
              {city.finding_count || 0} signals
            </span>
          </button>
        ))}
      </div>

      {currentCity && (
        <>
          {/* Status bar */}
          <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><span style={{ color: subTxt, fontSize: 12 }}>Status: </span><span style={{ color: currentCity.status === 'success' ? '#1D9E75' : '#BA7517', fontWeight: 600, fontSize: 13 }}>{currentCity.status === 'success' ? '✅ Data found' : '⚠️ Limited data'}</span></div>
            <div><span style={{ color: subTxt, fontSize: 12 }}>PDFs parsed: </span><span style={{ color: txt, fontWeight: 600, fontSize: 13 }}>{currentCity.pdfs_found || 0}</span></div>
            <div><span style={{ color: subTxt, fontSize: 12 }}>Signals found: </span><span style={{ color: txt, fontWeight: 600, fontSize: 13 }}>{currentCity.finding_count || 0}</span></div>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveCategory('all')} style={pillStyle(activeCategory === 'all', isDark)}>All</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={pillStyle(activeCategory === cat, isDark)}>
                  {CATEGORY_ICONS[cat]} {currentCity.findings.filter(f => f.category === cat).length > 0 ?
                    `${cat.replace(/_/g, ' ')} (${currentCity.findings.filter(f => f.category === cat).length})` :
                    cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Findings */}
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: subTxt, background: bg, borderRadius: 10, border: `1px solid ${border}` }}>
              {currentCity.status === 'no_findings'
                ? "No signals found — the city website may require JavaScript or have a different structure than expected. Try the refresh button or check the city website directly."
                : "No findings in this category."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((f, i) => (
                <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[f.category]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: CATEGORY_COLORS[f.category], textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.category_label}</span>
                    <span style={{ fontSize: 11, color: subTxt, marginLeft: 'auto' }}>{f.source}</span>
                  </div>
                  <p style={{ fontSize: 13, color: txt, lineHeight: 1.6, margin: 0 }}>
                    "...{f.snippet}..."
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const pillStyle = (active, isDark) => ({
  padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 600,
  background: active ? '#7F77DD' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
  color: active ? '#fff' : isDark ? '#C0C0C0' : '#555',
})
