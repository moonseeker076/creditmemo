import { useState, useEffect } from 'react'

const CITY_LINKS = {
  blairsville_ga: [
    { label: 'Blairsville City Council Minutes', url: 'https://www.blairsville-ga.gov/citycouncil' },
    { label: 'Union County Commission Minutes', url: 'https://www.unioncountyga.gov/391/Commission-Meeting-Agendas-Minutes' },
  ],
  indianapolis_in: [
    { label: 'Indianapolis City-County Council Minutes', url: 'https://www.indy.gov/activity/council-meeting-minutes' },
    { label: 'Indianapolis Full Council Agendas', url: 'https://www.indy.gov/activity/council-meeting-agendas' },
  ],
  nashville_tn: [
    { label: 'Nashville Metro Council Minutes', url: 'https://www.nashville.gov/departments/metro-clerk/legislative/minutes' },
    { label: 'Nashville Planning Commission', url: 'https://www.nashville.gov/departments/planning' },
  ],
}

const CATEGORY_COLORS = {
  permit_activity:    '#378ADD',
  retail_commercial:  '#1D9E75',
  residential:        '#7F77DD',
  infrastructure:     '#BA7517',
  economic_development: '#D85A30',
  major_employer:     '#7F77DD',
}

const CATEGORY_ICONS = {
  permit_activity:    '🏗️',
  retail_commercial:  '🏢',
  residential:        '🏘️',
  infrastructure:     '🛣️',
  economic_development: '💼',
  major_employer:     '🏭',
}

const CATEGORY_LABELS = {
  permit_activity:    'Permit Activity',
  retail_commercial:  'Commercial Permit',
  residential:        'Residential',
  infrastructure:     'Infrastructure',
  economic_development: 'Economic Development',
  major_employer:     'Major Employer',
}

const ALL_CATEGORIES = ['permit_activity', 'retail_commercial', 'residential', 'infrastructure', 'economic_development', 'major_employer']

export default function CityIntelligence({ theme }) {
  const isDark = theme === 'dark'
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => {
    fetch('http://localhost:8000/api/intelligence')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const txt    = isDark ? '#E8E8E8' : '#1A1A1A'
  const bg     = isDark ? '#1A1D2E' : '#F7F7F7'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const sub    = '#888'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: sub }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      Fetching live permit data from city open data portals…
    </div>
  )

  if (error) return (
    <div style={{ padding: 20, color: '#D85A30' }}>
      Error loading intelligence: {error}
    </div>
  )

  const cities  = data?.cities || []
  const current = selectedCity
    ? cities.find(c => c.city_id === selectedCity)
    : cities[0]

  if (!current) return null

  const allFindings = current.findings || []
  const categories  = [...new Set(allFindings.map(f => f.category))]

  let filtered = activeCategory === 'all'
    ? allFindings
    : allFindings.filter(f => f.category === activeCategory)

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase()
    filtered = filtered.filter(f =>
      (f.snippet || '').toLowerCase().includes(q) ||
      (f.applicant || '').toLowerCase().includes(q) ||
      (f.address || '').toLowerCase().includes(q) ||
      (f.permit_type || '').toLowerCase().includes(q)
    )
  }

  if (sortBy === 'date') {
    filtered = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  } else if (sortBy === 'value') {
    filtered = [...filtered].sort((a, b) => {
      const parse = v => parseFloat((v || '0').replace(/[$MKB,]/g, '')) *
        ((v||'').includes('M') ? 1000 : (v||'').includes('B') ? 1000000 : 1)
      return parse(b.value) - parse(a.value)
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: txt, fontSize: 15, fontWeight: 700 }}>
          🏛️ City Intelligence Feed — Live Permit Data
        </h3>
        <span style={{ fontSize: 12, color: sub }}>
          {data?.last_refreshed ? `Updated ${new Date(data.last_refreshed).toLocaleString()}` : ''}
        </span>
      </div>

      {/* City tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {cities.map(city => {
          const active = (selectedCity || cities[0]?.city_id) === city.city_id
          return (
            <button key={city.city_id}
              onClick={() => { setSelectedCity(city.city_id); setActiveCategory('all'); setSearchTerm('') }}
              style={{
                padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                background: active ? '#378ADD' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                color: active ? '#fff' : isDark ? '#C0C0C0' : '#444',
              }}
            >
              {city.city_name}
              <span style={{ marginLeft: 7, fontSize: 11, opacity: 0.75 }}>
                {city.finding_count || 0} permits
              </span>
            </button>
          )
        })}
      </div>

      {/* Status bar */}
      <div style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 10,
        padding: '12px 18px', marginBottom: 16,
        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <span style={{ color: sub, fontSize: 12 }}>Status: </span>
          <span style={{ color: current.status === 'success' ? '#1D9E75' : '#BA7517', fontWeight: 600, fontSize: 13 }}>
            {current.status === 'success' ? '✅ Live data' : '⚠️ Limited'}
          </span>
        </div>
        <div>
          <span style={{ color: sub, fontSize: 12 }}>Records: </span>
          <span style={{ color: txt, fontWeight: 700, fontSize: 13 }}>{current.finding_count || 0}</span>
        </div>
        <div>
          <span style={{ color: sub, fontSize: 12 }}>Source: </span>
          <span style={{ color: txt, fontSize: 12 }}>
            {current.city_id === 'nashville_tn'    ? 'data.nashville.gov — Socrata Open Data API' :
             current.city_id === 'indianapolis_in' ? 'data.indy.gov — ArcGIS FeatureServer API'   :
             'Blairsville City Council Minutes (PDF)'}
          </span>
        </div>
      </div>

      {/* Filters + search + sort */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setActiveCategory('all')}
          style={pillStyle(activeCategory === 'all', isDark, '#7F77DD')}>
          All ({allFindings.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            style={pillStyle(activeCategory === cat, isDark, CATEGORY_COLORS[cat] || '#888')}>
            {CATEGORY_ICONS[cat] || '📋'} {CATEGORY_LABELS[cat] || cat} ({allFindings.filter(f => f.category === cat).length})
          </button>
        ))}
        <input
          type="text"
          placeholder="Search applicant, address, type…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${border}`, background: inputBg,
            color: txt, fontSize: 13, width: 220, outline: 'none',
          }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`,
            background: inputBg, color: txt, fontSize: 13, cursor: 'pointer',
          }}>
          <option value="date">Sort: Newest</option>
          <option value="value">Sort: Highest Value</option>
        </select>
      </div>

      {/* Category Summary Grid */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Signal Summary by Category</div>
        {ALL_CATEGORIES.every(cat => allFindings.filter(f => f.category === cat).length === 0) ? (
          <div style={{ padding: '14px 18px', background: bg, border: `1px solid ${border}`, borderRadius: 10, fontSize: 13, color: sub }}>
            No signals detected in automated scan — review official minutes directly using the links below.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {ALL_CATEGORIES.map(cat => {
              const count = allFindings.filter(f => f.category === cat).length
              const color = CATEGORY_COLORS[cat] || '#888'
              return (
                <div key={cat} style={{
                  background: color + '12', border: `1px solid ${color}30`, borderRadius: 10,
                  padding: '12px 14px', cursor: count > 0 ? 'pointer' : 'default',
                  opacity: count === 0 ? 0.45 : 1,
                }} onClick={() => count > 0 && setActiveCategory(cat)}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{CATEGORY_ICONS[cat]}</div>
                  <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{CATEGORY_LABELS[cat]}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Official Links */}
      {CITY_LINKS[current.city_id] && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Official Sources</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CITY_LINKS[current.city_id].map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                padding: '7px 14px', borderRadius: 8, border: `1px solid ${border}`,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                fontSize: 12, color: '#378ADD', textDecoration: 'none', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                🔗 {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: sub, background: bg, borderRadius: 10, border: `1px solid ${border}` }}>
          {current.status !== 'success'
            ? 'No data returned. Try refreshing or check that the backend is running.'
            : 'No permits match your search or filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((f, i) => (
            <PermitCard key={i} f={f} isDark={isDark} txt={txt} bg={bg} border={border} sub={sub} />
          ))}
        </div>
      )}
    </div>
  )
}

function PermitCard({ f, isDark, txt, bg, border, sub }) {
  const color = CATEGORY_COLORS[f.category] || '#888'
  const icon  = CATEGORY_ICONS[f.category]  || '📋'
  const label = CATEGORY_LABELS[f.category] || f.category

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          {f.permit_number && <span style={{ fontSize: 11, color: sub }}>#{f.permit_number}</span>}
        </div>

        {f.applicant && (
          <div style={{ fontSize: 14, fontWeight: 700, color: txt, marginBottom: 3 }}>{f.applicant}</div>
        )}

        {(f.permit_type || f.work_class) && (
          <div style={{ fontSize: 13, color: sub, marginBottom: f.address ? 3 : 0 }}>
            {[f.permit_type, f.work_class].filter(Boolean).join(' · ')}
          </div>
        )}

        {f.address && (
          <div style={{ fontSize: 12, color: sub }}>📍 {f.address}</div>
        )}

        {!f.applicant && !f.address && f.snippet && (
          <p style={{ fontSize: 13, color: txt, lineHeight: 1.6, margin: 0 }}>{f.snippet}</p>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {f.value && (
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1D9E75', marginBottom: 4 }}>{f.value}</div>
        )}
        {f.date && (
          <div style={{ fontSize: 11, color: sub }}>
            {new Date(f.date + 'T00:00:00Z').toLocaleDateString('en-US',
              { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </div>
        )}
        <div style={{ fontSize: 11, color: sub, marginTop: 4, maxWidth: 160, textAlign: 'right' }}>{f.source}</div>
      </div>
    </div>
  )
}

const pillStyle = (active, isDark, color) => ({
  padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
  background: active ? color : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
  color: active ? '#fff' : isDark ? '#C0C0C0' : '#555',
})
