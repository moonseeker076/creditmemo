import { fmtPct } from '../utils/formatters.js'

const getThesis = (m) => {
  const pattern = m.analysis?.pattern
  if (pattern === 'supply_pull') return 'Strong developer + job activity — new construction opportunity'
  if (pattern === 'demand_surge') return 'Supply lagging demand — rent pressure building, strong acquisition play'
  if (pattern === 'population_play') return 'Migration-driven demand — residential and retail follow-through expected'
  if (pattern === 'jobs_led') return 'Employment leading — permit surge likely in next 6–12 months'
  if (pattern === 'broad_momentum') return 'Balanced growth across all indicators — lower-risk entry point'
  // fallback
  if (m.permit_growth_yoy > 5 && m.employment_growth_yoy > 2) return 'Permits + jobs accelerating — strong demand pull'
  if (m.permit_growth_yoy > 0 && m.employment_growth_yoy > 0) return 'Positive across all metrics — balanced growth'
  return 'All three indicators above median — confirmed deal signal'
}

export default function DealSignalCards({ markets, theme }) {
  const isDark = theme === 'dark'
  const deals = markets.filter(m => m.deal_signal)

  if (deals.length === 0) return null

  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = 'rgba(29,158,117,0.25)'
  const bg = isDark ? 'rgba(29,158,117,0.07)' : 'rgba(29,158,117,0.05)'

  return (
    <div>
      <h3 style={{ color: txt, fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔥 Deal Signal Markets — All 3 Indicators Aligned</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {deals.map(m => {
          const city = m.name.split(',')[0].split('–')[0]
          const thesis = getThesis(m)

          return (
            <div key={m.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: txt, fontSize: 15 }}>{city}</div>
                  <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600 }}>{m.region} · Score {Math.round(m.composite_score || 0)}</div>
                </div>
                <span style={{ fontSize: 22 }}>🏗️</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Permits', value: fmtPct(m.permit_growth_yoy) },
                  { label: 'Jobs', value: fmtPct(m.employment_growth_yoy) },
                  { label: 'Pop', value: fmtPct(m.population_growth_yoy) },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1D9E75' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', borderTop: `1px solid ${border}`, paddingTop: 8 }}>{thesis}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
