import { X } from 'lucide-react'
import { fmtPct, fmtNum, fmtScore, fmtCurrency } from '../utils/formatters.js'

const ROWS = [
  { label: 'Composite Score', key: 'composite_score', fmt: fmtScore, color: '#7F77DD' },
  { label: 'Signal', key: 'signal', fmt: v => v || '—' },
  { label: 'Permit Growth YoY', key: 'permit_growth_yoy', fmt: fmtPct },
  { label: 'Employment Growth YoY', key: 'employment_growth_yoy', fmt: fmtPct },
  { label: 'Population Growth YoY', key: 'population_growth_yoy', fmt: fmtPct },
  { label: 'Unemployment Rate', key: 'unemployment_rate', fmt: v => v != null ? `${v.toFixed(1)}%` : '—' },
  { label: 'Median Home Value', key: 'home_value', fmt: v => v ? fmtCurrency(v) : '—' },
  { label: 'Home Value YoY', key: 'home_value_yoy', fmt: fmtPct },
  { label: 'Rent Index (ZORI)', key: 'rent_index', fmt: v => v ? `$${Math.round(v).toLocaleString()}` : '—' },
  { label: 'Rent YoY', key: 'rent_yoy', fmt: fmtPct },
  { label: 'Population', key: 'population', fmt: fmtNum },
  { label: 'Total Employment', key: 'total_employment', fmt: fmtNum },
  { label: 'Median Income', key: 'median_income', fmt: fmtCurrency },
]

function signalColor(v) {
  return v === 'Hot' ? '#1D9E75' : v === 'Rising' ? '#378ADD' : '#BA7517'
}

function valueColor(row, val) {
  if (row.key.includes('growth') || row.key.includes('yoy')) {
    const n = parseFloat(val)
    if (!isNaN(n)) return n > 0 ? '#1D9E75' : n < 0 ? '#D85A30' : null
  }
  if (row.key === 'signal') return signalColor(val)
  return null
}

export default function CompareModal({ metros, onClose, theme }) {
  if (!metros || metros.length < 2) return null
  const isDark = theme === 'dark'
  const bg = isDark ? '#13161f' : '#fff'
  const rowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const sub = '#888'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: Math.min(900, metros.length * 240 + 200), maxWidth: '95vw', maxHeight: '90vh',
        background: bg, borderRadius: 16, zIndex: 301, overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)', padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: txt, fontSize: 17, fontWeight: 700 }}>Metro Comparison</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub }}><X size={20} /></button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: sub, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${border}` }}>Metric</th>
                {metros.map(m => (
                  <th key={m.id} style={{ textAlign: 'center', padding: '8px 12px', color: txt, fontWeight: 700, borderBottom: `1px solid ${border}`, minWidth: 140 }}>
                    {m.name.split(',')[0].split('–')[0].trim()}
                    <div style={{ fontSize: 11, color: sub, fontWeight: 400, marginTop: 2 }}>{m.state} · {m.region}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? rowBg : 'transparent' }}>
                  <td style={{ padding: '10px 12px', color: sub, fontWeight: 500 }}>{row.label}</td>
                  {metros.map(m => {
                    const raw = m[row.key]
                    const formatted = row.fmt(raw)
                    const color = valueColor(row, raw) || (row.color) || txt
                    return (
                      <td key={m.id} style={{ textAlign: 'center', padding: '10px 12px', fontWeight: row.key === 'composite_score' ? 800 : 600, color }}>
                        {formatted}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
