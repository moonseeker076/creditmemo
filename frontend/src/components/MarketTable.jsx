import { useState } from 'react'
import { fmtPct, fmtScore } from '../utils/formatters.js'
import { getPctColor, getSignalBg } from '../utils/scoring.js'

const COL = ['rank', 'name', 'region', 'permit_growth_yoy', 'employment_growth_yoy', 'population_growth_yoy', 'composite_score', 'signal']
const LABELS = { rank: '#', name: 'Metro', region: 'Region', permit_growth_yoy: 'Permit Growth', employment_growth_yoy: 'Emp Growth', population_growth_yoy: 'Pop Trend', composite_score: 'Score', signal: 'Signal' }

export default function MarketTable({ markets, onSelect, theme }) {
  const isDark = theme === 'dark'
  const [sortCol, setSortCol] = useState('composite_score')
  const [sortDir, setSortDir] = useState(-1)

  const sorted = [...markets].sort((a, b) => {
    const av = a[sortCol] ?? -999, bv = b[sortCol] ?? -999
    return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir
  })

  const handleSort = (col) => {
    if (col === sortCol) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(-1) }
  }

  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const hdr = isDark ? '#888' : '#666'
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: isDark ? '#13161f' : '#f0f0f0' }}>
            {COL.map(c => (
              <th key={c} onClick={() => handleSort(c)} style={{ padding: '10px 14px', textAlign: 'left', color: hdr, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                {LABELS[c]} {sortCol === c ? (sortDir === -1 ? '↓' : '↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => (
            <tr
              key={m.id}
              onClick={() => onSelect(m)}
              style={{ cursor: 'pointer', borderTop: `1px solid ${border}`, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = rowHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '10px 14px', color: '#888', fontWeight: 600 }}>{i + 1}</td>
              <td style={{ padding: '10px 14px', color: txt, fontWeight: 600 }}>{m.name}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{m.region}</td>
              <td style={{ padding: '10px 14px', color: getPctColor(m.permit_growth_yoy) }}>{fmtPct(m.permit_growth_yoy)}</td>
              <td style={{ padding: '10px 14px', color: getPctColor(m.employment_growth_yoy) }}>{fmtPct(m.employment_growth_yoy)}</td>
              <td style={{ padding: '10px 14px', color: getPctColor(m.population_growth_yoy) }}>{fmtPct(m.population_growth_yoy)}</td>
              <td style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 6, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 3 }}>
                    <div style={{ width: `${m.composite_score || 0}%`, height: '100%', background: '#7F77DD', borderRadius: 3 }} />
                  </div>
                  <span style={{ color: '#7F77DD', fontWeight: 700 }}>{fmtScore(m.composite_score)}</span>
                </div>
              </td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                  background: getSignalBg(m.signal),
                  color: m.signal === 'Hot' ? '#1D9E75' : m.signal === 'Rising' ? '#378ADD' : '#BA7517'
                }}>
                  {m.signal}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
