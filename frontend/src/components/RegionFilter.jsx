const REGIONS = ['All', 'Southeast', 'South', 'Mountain West', 'Midwest', 'Southwest', 'Northeast']

export default function RegionFilter({ active, onChange, theme }) {
  const isDark = theme === 'dark'
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {REGIONS.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: active === r
              ? '#1D9E75'
              : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            color: active === r ? '#fff' : isDark ? '#C0C0C0' : '#444',
            transition: 'all 0.15s',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
