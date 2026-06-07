import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtPct, fmtNum, fmtScore, fmtCurrency, fmtDate } from '../utils/formatters.js'
import { getSignalBg } from '../utils/scoring.js'

function TrendPill({ label, trend, isDark }) {
  const arrow = trend === 'accelerating' ? '↑' : trend === 'decelerating' ? '↓' : trend === 'stable' ? '→' : '?'
  const color = trend === 'accelerating' ? '#1D9E75' : trend === 'decelerating' ? '#D85A30' : '#BA7517'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: color + '18', color, marginRight: 6, marginBottom: 4,
    }}>
      {arrow} {label}: {trend}
    </span>
  )
}

function AnalysisPanel({ metro, isDark }) {
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const sub = '#888'
  const bg2 = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const border2 = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const a = metro.analysis
  if (!a) {
    // Fallback simple thesis
    const name = metro.name.split(',')[0]
    const parts = []
    if (metro.permit_growth_yoy > 0) parts.push(`permit activity up ${metro.permit_growth_yoy?.toFixed(1)}% YoY`)
    if (metro.employment_growth_yoy > 0) parts.push(`employment growth of ${metro.employment_growth_yoy?.toFixed(1)}%`)
    if (metro.population_growth_yoy > 0) parts.push(`population growth of ${metro.population_growth_yoy?.toFixed(1)}%`)
    const thesis = parts.length ? `${name} shows ${parts.join(', ')}. Composite score of ${Math.round(metro.composite_score || 0)} ranks it as a ${metro.signal} market.` : `${name} is currently in watch mode with mixed signals.`
    return <p style={{ fontSize: 13, color: txt, lineHeight: 1.6 }}>{thesis}</p>
  }

  const total = a.total_metros || 24

  // Build analyst paragraph
  const name = metro.name.split(',')[0].split('–')[0].trim()
  const rankDesc = (r) => r === 1 ? '#1' : r <= 3 ? `#${r}` : r <= Math.ceil(total/3) ? `#${r} (top third)` : `#${r}`

  const sentences = []
  sentences.push(`${name} ranks ${rankDesc(a.composite_rank)} overall of ${total} tracked metros, with permit growth at ${rankDesc(a.permit_rank)} and employment growth at ${rankDesc(a.employment_rank)}.`)

  if (a.permit_trend === 'accelerating') {
    sentences.push(`Permit activity has been accelerating over the last 6 months, signaling growing developer confidence in this market.`)
  } else if (a.permit_trend === 'decelerating') {
    sentences.push(`Permit activity has been slowing over the last 6 months — worth monitoring for whether this is a temporary pause or a trend reversal.`)
  }

  if (a.pattern !== 'watch') {
    sentences.push(a.investor_implication)
  }

  if (metro.deal_signal) {
    sentences.push(`All three indicators are simultaneously positive and above their median across tracked metros — this is a confirmed deal signal.`)
  } else if (a.pattern === 'watch') {
    sentences.push(a.investor_implication)
  }

  return (
    <div>
      {/* Peer ranking row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'Overall', rank: a.composite_rank, color: '#7F77DD' },
          { label: 'Permits', rank: a.permit_rank, color: '#1D9E75' },
          { label: 'Employment', rank: a.employment_rank, color: '#378ADD' },
          { label: 'Population', rank: a.population_rank, color: '#BA7517' },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '5px 12px', borderRadius: 10,
            background: item.color + '15', border: `1px solid ${item.color}30`,
            fontSize: 12,
          }}>
            <span style={{ color: sub }}>{item.label}: </span>
            <span style={{ color: item.color, fontWeight: 800 }}>#{item.rank}</span>
            <span style={{ color: sub }}> of {total}</span>
          </div>
        ))}
      </div>

      {/* Trend pills */}
      <div style={{ marginBottom: 12 }}>
        <TrendPill label="Permits" trend={a.permit_trend} isDark={isDark} />
        <TrendPill label="Employment" trend={a.employment_trend} isDark={isDark} />
      </div>

      {/* Pattern badge */}
      {a.pattern !== 'watch' && (
        <div style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: 20,
          background: '#1D9E75' + '20', border: '1px solid #1D9E75' + '40',
          fontSize: 12, fontWeight: 700, color: '#1D9E75', marginBottom: 12,
        }}>
          {a.pattern_label} Market
        </div>
      )}

      {/* Analyst paragraph */}
      <div style={{ background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.18)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>ANALYST ASSESSMENT</div>
        {sentences.map((s, i) => (
          <p key={i} style={{ fontSize: 13, color: txt, lineHeight: 1.7, margin: i < sentences.length - 1 ? '0 0 8px 0' : 0 }}>{s}</p>
        ))}
      </div>

      {/* Recent news */}
      {(a.recent_news || []).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>📰 Recent Projects & Announcements</div>
          {(a.recent_news || []).map((item, i) => (
            <div key={i} style={{ background: bg2, border: `1px solid ${border2}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: txt, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: sub, lineHeight: 1.5, marginBottom: 4 }}>{item.snippet}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: sub }}>{item.source}</span>
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#378ADD' }}>Read more →</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MetroDrawer({ metro, onClose, theme }) {
  const isDark = theme === 'dark'
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!metro) return
    setDetail(null)
    fetch(`http://localhost:8000/api/markets/${metro.id}`)
      .then(r => r.json())
      .then(d => setDetail(d))
      .catch(() => setDetail(metro))
  }, [metro?.id])

  if (!metro) return null

  const m = detail || metro

  const bg = isDark ? '#1A1D2E' : '#F7F7F7'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const subTxt = '#888'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tipStyle = { background: isDark ? '#13161f' : '#fff', border: `1px solid ${border}`, borderRadius: 8 }

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
            <h2 style={{ color: txt, fontSize: 18, fontWeight: 700 }}>{m.name}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <span style={{ color: subTxt, fontSize: 13 }}>{m.region}</span>
              <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: getSignalBg(m.signal), color: m.signal === 'Hot' ? '#1D9E75' : m.signal === 'Rising' ? '#378ADD' : '#BA7517' }}>{m.signal}</span>
              {m.deal_signal && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(29,158,117,0.2)', color: '#1D9E75' }}>🔥 Deal Signal</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: subTxt, padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Key Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Composite Score', value: fmtScore(m.composite_score), color: '#7F77DD' },
              { label: 'Permit Growth', value: fmtPct(m.permit_growth_yoy), color: m.permit_growth_yoy > 0 ? '#1D9E75' : '#D85A30' },
              { label: 'Emp Growth', value: fmtPct(m.employment_growth_yoy), color: m.employment_growth_yoy > 0 ? '#1D9E75' : '#D85A30' },
              { label: 'Population', value: fmtNum(m.population), color: txt },
              { label: 'Median Income', value: fmtCurrency(m.median_income), color: txt },
              { label: 'Employment', value: fmtNum(m.total_employment), color: txt },
            ].map((s, i) => (
              <div key={i} style={{ background: bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${border}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: subTxt, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Why This Market */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>WHY THIS MARKET</div>
            <AnalysisPanel metro={m} isDark={isDark} />
          </div>

          {/* Permit Chart */}
          {(m.permit_series || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 10 }}>Permit Volume (24 months)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={m.permit_series.slice(-24)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
          {(m.employment_series || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 10 }}>Employment (24 months)</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={m.employment_series.slice(-24)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
