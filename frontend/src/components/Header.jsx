import { RefreshCw, Sun, Moon, TrendingUp } from 'lucide-react'

export default function Header({ theme, onToggleTheme, onRefresh, loading, lastRefreshed }) {
  const isDark = theme === 'dark'
  const s = styles(isDark)

  const ts = lastRefreshed
    ? new Date(lastRefreshed).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <header style={s.header}>
      <div style={s.brand}>
        <TrendingUp size={22} color="#1D9E75" />
        <span style={s.title}>Market Intelligence</span>
        <span style={s.sub}>Real Estate Deal Prospecting</span>
      </div>
      <div style={s.right}>
        <span style={s.ts}>Updated {ts}</span>
        <button style={s.btn} onClick={onRefresh} disabled={loading} title="Refresh data">
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button style={s.btn} onClick={onToggleTheme} title="Toggle theme">
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  )
}

const styles = (isDark) => ({
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: isDark ? '#13161f' : '#fff',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontWeight: 700, fontSize: 17, color: isDark ? '#E8E8E8' : '#1A1A1A' },
  sub: { fontSize: 12, color: '#888', marginLeft: 4 },
  right: { display: 'flex', alignItems: 'center', gap: 10 },
  ts: { fontSize: 12, color: '#888' },
  btn: {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
    color: isDark ? '#E8E8E8' : '#1A1A1A', display: 'flex', alignItems: 'center',
  },
})
