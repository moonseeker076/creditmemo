import { useState } from 'react'

const METRICS = [
  { key: 'permits',    label: 'Permit Growth',    color: '#1D9E75' },
  { key: 'employment', label: 'Employment Growth', color: '#378ADD' },
  { key: 'population', label: 'Population Growth', color: '#7F77DD' },
]

export default function WeightControls({ weights, setWeights, resetWeights, isDefault, theme }) {
  const [open, setOpen] = useState(false)
  const isDark = theme === 'dark'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const bg = isDark ? '#1A1D2E' : '#F7F7F7'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const sub = '#888'

  const handleChange = (key, rawVal) => {
    const val = Math.max(5, Math.min(90, Number(rawVal)))
    const others = METRICS.filter(m => m.key !== key)
    const remaining = 100 - val
    const currentOtherTotal = others.reduce((s, m) => s + weights[m.key], 0)
    const next = { ...weights, [key]: val }
    if (currentOtherTotal === 0) {
      const share = Math.round(remaining / 2)
      next[others[0].key] = share
      next[others[1].key] = remaining - share
    } else {
      others.forEach(m => {
        next[m.key] = Math.max(5, Math.round(weights[m.key] / currentOtherTotal * remaining))
      })
      // fix rounding drift
      const total = METRICS.reduce((s, m) => s + next[m.key], 0)
      if (total !== 100) next[others[0].key] += 100 - total
    }
    setWeights(next)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, border: `1px solid ${border}`,
          background: open ? (isDark ? 'rgba(127,119,221,0.15)' : 'rgba(127,119,221,0.1)') : 'transparent',
          color: isDefault ? sub : '#7F77DD', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ⚙️ Weights {!isDefault && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#7F77DD22', color: '#7F77DD' }}>Custom</span>}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 99,
            background: isDark ? '#13161f' : '#fff',
            border: `1px solid ${border}`, borderRadius: 14,
            padding: '20px 22px', width: 300,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: txt }}>Score Weights</span>
              {!isDefault && (
                <button onClick={resetWeights} style={{ fontSize: 11, color: sub, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Reset to defaults
                </button>
              )}
            </div>

            {METRICS.map(({ key, label, color }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: txt }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color }}>{weights[key]}%</span>
                </div>
                <input
                  type="range" min={5} max={90} value={weights[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
                />
              </div>
            ))}

            <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', fontSize: 11, color: sub }}>
              Total: {METRICS.reduce((s, m) => s + weights[m.key], 0)}% · Scores recalculate live
            </div>
          </div>
        </>
      )}
    </div>
  )
}
