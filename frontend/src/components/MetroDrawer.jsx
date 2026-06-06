import { X } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtPct, fmtNum, fmtScore, fmtCurrency, fmtDate } from '../utils/formatters.js'
import { getSignalBg } from '../utils/scoring.js'

export default function MetroDrawer({ metro, onClose, theme }) {
  const isDark = theme === 'dark'
  if (!metro) return null

  const bg = isDark ? '#1A1D2E' : '#F7F7F7'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const subTxt = '#888'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tipStyle = { background: isDark ? '#13161f' : '#fff', border: `1px solid ${border}`, borderRadius: 8 }

  const thesis = buildThesis(metro)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, maxWidth: '95vw',
        background: isDark ? '#13161f' : '#fff', zIndex: 201, overflowY: 'auto',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: `1px solid ${border}` }}>
          <div>
            <h2 style={{ color: txt, fontSize: 18, fontWeight: 700 }}>{metro.name}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <span style={{ color: subTxt, fontSize: 13 }}>{metro.region}</span>
              <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: getSignalBg(metro.signal), color: metro.signal === 'Hot' ? '#1D9E75' : metro.signal === 'Rising' ? '#378ADD' : '#BA7517' }}>{metro.signal}</span>
              {metro.deal_signal && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(29,158,117,0.2)', color: '#1D9E75' }}>🔥 Deal Signal</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: subTxt, padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Key Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Composite Score', value: fmtScore(metro.composite_score), color: '#7F77DD' },
              { label: 'Permit Growth', value: fmtPct(metro.permit_growth_yoy), color: metro.permit_growth_yoy > 0 ? '#1D9E75' : '#D85A30' },
              { label: 'Emp Growth', value: fmtPct(metro.employment_growth_yoy), color: metro.employment_growth_yoy > 0 ? '#1D9E75' : '#D85A30' },
              { label: 'Population', value: fmtNum(metro.population), color: txt },
              { label: 'Median Income', value: fmtCurrency(metro.median_income), color: txt },
              { label: 'Employment', value: fmtNum(metro.total_employment), color: txt },
            ].map((s, i) => (
              <div key={i} style={{ background: bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${border}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: subTxt, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Deal Thesis */}
          <div style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75', marginBottom: 6 }}>WHY THIS MARKET</div>
            <p style={{ fontSize: 13, color: txt, lineHeight: 1.6 }}>{thesis}</p>
          </div>

          {/* Permit Chart */}
          {(metro.permit_series || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 10 }}>Permit Volume (24 months)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={metro.permit_series.slice(-24)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: subTxt, fontSize: 10 }} />
                  <YAxis tick={{ fill: subTxt, fontSize: 10 }} />
                  <Tooltip contentStyle={tipStyle} labelFormatter={fmtDate} />
                  <Bar dataKey="value" fill="#1D9E75" radius={[3, 3, 0, 0]} name="Permits" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Employment Chart */}
          {(metro.employment_series || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 10 }}>Employment (24 months)</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={metro.employment_series.slice(-24)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: subTxt, fontSize: 10 }} />
                  <YAxis tick={{ fill: subTxt, fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tipStyle} labelFormatter={fmtDate} formatter={v => [v?.toLocaleString(), 'Employed']} />
                  <Line type="monotone" dataKey="value" stroke="#378ADD" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function buildThesis(m) {
  const parts = []
  const name = m.name.split(',')[0]
  if (m.permit_growth_yoy > 10) parts.push(`strong permit activity up ${m.permit_growth_yoy.toFixed(1)}% YoY`)
  else if (m.permit_growth_yoy > 0) parts.push(`steady permit activity up ${m.permit_growth_yoy?.toFixed(1)}% YoY`)
  if (m.employment_growth_yoy > 2) parts.push(`robust job creation at ${m.employment_growth_yoy?.toFixed(1)}% employment growth`)
  else if (m.employment_growth_yoy > 0) parts.push(`positive employment growth of ${m.employment_growth_yoy?.toFixed(1)}%`)
  if (m.population_growth_yoy > 1) parts.push(`notable population inflow of ${m.population_growth_yoy?.toFixed(1)}% YoY`)
  if (m.deal_signal) parts.push('all three indicators are simultaneously positive and above their median across tracked metros — a confirmed deal signal')
  if (parts.length === 0) return `${name} is currently in watch mode with mixed signals across permit, employment, and population indicators.`
  return `${name} shows ${parts.join(', ')}. Composite score of ${Math.round(m.composite_score || 0)} ranks it as a ${m.signal} market.`
}
