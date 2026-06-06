import { fmtPct, fmtNum } from '../utils/formatters.js'

export default function MetricCards({ summary, theme }) {
  const isDark = theme === 'dark'
  const s = styles(isDark)

  const cards = [
    { label: 'Markets Tracked', value: fmtNum(summary?.total_markets), color: '#7F77DD', icon: '📍' },
    { label: 'Avg Permit Growth (Top 10)', value: fmtPct(summary?.avg_permit_growth), color: '#1D9E75', icon: '🏗️' },
    { label: 'Hot Deal Signals', value: fmtNum(summary?.hot_markets), color: '#D85A30', icon: '🔥' },
    { label: 'Avg Employment Growth', value: fmtPct(summary?.avg_employment_growth), color: '#378ADD', icon: '💼' },
  ]

  return (
    <div style={s.grid}>
      {cards.map((c, i) => (
        <div key={i} style={s.card}>
          <div style={s.icon}>{c.icon}</div>
          <div style={{ ...s.value, color: c.color }}>{c.value}</div>
          <div style={s.label}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

const styles = (isDark) => ({
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
    '@media(max-width:768px)': { gridTemplateColumns: '1fr 1fr' },
  },
  card: {
    background: isDark ? '#1A1D2E' : '#F7F7F7',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 12, padding: '20px 24px', textAlign: 'center',
  },
  icon: { fontSize: 28, marginBottom: 8 },
  value: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  label: { fontSize: 12, color: '#888', fontWeight: 500 },
})
