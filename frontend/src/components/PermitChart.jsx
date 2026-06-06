import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function PermitChart({ markets, theme }) {
  const isDark = theme === 'dark'
  const top8 = [...markets].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).slice(0, 8)

  const data = top8.map(m => ({
    name: m.name.split(',')[0].split('–')[0].trim(),
    Residential: m.residential_permits || 0,
    Commercial: m.commercial_permits || 0,
  }))

  return (
    <div style={cardStyle(isDark)}>
      <h3 style={titleStyle(isDark)}>Permit Volume — Top 8 Markets</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
          <XAxis dataKey="name" tick={{ fill: isDark ? '#888' : '#555', fontSize: 11 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fill: isDark ? '#888' : '#555', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: isDark ? '#1A1D2E' : '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: isDark ? '#E8E8E8' : '#1A1A1A' }}
          />
          <Legend wrapperStyle={{ paddingTop: 8, color: isDark ? '#888' : '#555' }} />
          <Bar dataKey="Residential" fill="#1D9E75" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Commercial" fill="#378ADD" radius={[4, 4, 0, 0]} />
        </BarChart>
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
