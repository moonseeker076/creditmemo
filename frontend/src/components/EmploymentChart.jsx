import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fmtDate } from '../utils/formatters.js'

const LINE_COLORS = ['#1D9E75', '#378ADD', '#7F77DD', '#BA7517', '#D85A30']
const DASHES = ['0', '5 5', '3 3', '8 3', '5 2']

export default function EmploymentChart({ markets, theme }) {
  const isDark = theme === 'dark'
  const top5 = [...markets].sort((a, b) => (b.employment_growth_yoy || 0) - (a.employment_growth_yoy || 0)).slice(0, 5)

  // Build unified date axis from all series, last 6 quarters (~18 months)
  const allDates = new Set()
  top5.forEach(m => (m.employment_series || []).forEach(p => allDates.add(p.date)))
  const dates = Array.from(allDates).sort().slice(-18)

  const data = dates.map(date => {
    const row = { date }
    top5.forEach(m => {
      const pt = (m.employment_series || []).find(p => p.date === date)
      row[m.id] = pt ? pt.value : null
    })
    return row
  })

  return (
    <div style={cardStyle(isDark)}>
      <h3 style={titleStyle(isDark)}>Employment Trend — Top 5 Markets</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: isDark ? '#888' : '#555', fontSize: 11 }} />
          <YAxis tick={{ fill: isDark ? '#888' : '#555', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: isDark ? '#1A1D2E' : '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelFormatter={fmtDate}
            formatter={(v) => [v?.toLocaleString(), '']}
          />
          <Legend wrapperStyle={{ color: isDark ? '#888' : '#555' }} />
          {top5.map((m, i) => (
            <Line
              key={m.id}
              type="monotone"
              dataKey={m.id}
              name={m.name.split(',')[0].split('–')[0]}
              stroke={LINE_COLORS[i]}
              strokeDasharray={DASHES[i]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const cardStyle = (isDark) => ({
  background: isDark ? '#1A1D2E' : '#F7F7F7',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  borderRadius: 12, padding: 20,
})
const titleStyle = (isDark) => ({ fontSize: 14, fontWeight: 700, color: isDark ? '#E8E8E8' : '#1A1A1A', marginBottom: 16 })
