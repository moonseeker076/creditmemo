import { useState, useCallback } from 'react'
import { fmtPct, fmtScore } from '../utils/formatters.js'
import { getPctColor, getSignalBg } from '../utils/scoring.js'

const COL = ['rank', 'name', 'region', 'permit_growth_yoy', 'employment_growth_yoy', 'population_growth_yoy', 'composite_score', 'signal']
const LABELS = { rank: '#', name: 'Metro', region: 'Region', permit_growth_yoy: 'Permit Growth', employment_growth_yoy: 'Emp Growth', population_growth_yoy: 'Pop Trend', composite_score: 'Score', signal: 'Signal' }

const FAV_KEY = 'creditmemo_favorites'

function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { return new Set() }
}
function saveFavs(set) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])) } catch {}
}

function downloadCsv(markets) {
  const headers = ['Name', 'Region', 'State', 'Signal', 'Score', 'Permit Growth %', 'Employment Growth %', 'Population Growth %', 'Unemployment Rate %', 'Home Value', 'Home Value YoY %', 'Rent Index', 'Rent YoY %', 'Population', 'Median Income']
  const rows = markets.map(m => [
    m.name, m.region, m.state, m.signal,
    m.composite_score?.toFixed(1) ?? '',
    m.permit_growth_yoy?.toFixed(2) ?? '',
    m.employment_growth_yoy?.toFixed(2) ?? '',
    m.population_growth_yoy?.toFixed(2) ?? '',
    m.unemployment_rate?.toFixed(1) ?? '',
    m.home_value ? Math.round(m.home_value) : '',
    m.home_value_yoy?.toFixed(2) ?? '',
    m.rent_index ? Math.round(m.rent_index) : '',
    m.rent_yoy?.toFixed(2) ?? '',
    m.population ?? '',
    m.median_income ? Math.round(m.median_income) : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `creditmemo-markets-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function MarketTable({ markets, onSelect, onCompare, theme, watchlistOnly, onToggleWatchlist }) {
  const isDark = theme === 'dark'
  const [sortCol, setSortCol] = useState('composite_score')
  const [sortDir, setSortDir] = useState(-1)
  const [favorites, setFavoritesState] = useState(loadFavs)
  const [compareIds, setCompareIds] = useState(new Set())

  const toggleFav = useCallback((id, e) => {
    e.stopPropagation()
    setFavoritesState(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveFavs(next)
      return next
    })
  }, [])

  const toggleCompare = useCallback((id, e) => {
    e.stopPropagation()
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      if (next.size >= 3) return prev
      next.add(id)
      return next
    })
  }, [])

  const handleSort = (col) => {
    if (col === sortCol) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(-1) }
  }

  const visible = watchlistOnly ? markets.filter(m => favorites.has(m.id)) : markets
  const sorted = [...visible].sort((a, b) => {
    const av = a[sortCol] ?? -999, bv = b[sortCol] ?? -999
    return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir
  })

  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const hdr = isDark ? '#888' : '#666'
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const sub = '#888'

  const compareList = markets.filter(m => compareIds.has(m.id))

  return (
    <div>
      {/* Table toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onToggleWatchlist?.()}
          style={{
            padding: '6px 14px', borderRadius: 8, border: `1px solid ${border}`,
            background: watchlistOnly ? '#BA751720' : 'transparent',
            color: watchlistOnly ? '#BA7517' : sub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ⭐ Watchlist {favorites.size > 0 ? `(${favorites.size})` : ''}
        </button>
        <button
          onClick={() => downloadCsv(sorted)}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: sub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ↓ Export CSV
        </button>
        {compareIds.size >= 2 && (
          <button
            onClick={() => onCompare(compareList)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Compare ({compareIds.size})
          </button>
        )}
        {compareIds.size > 0 && (
          <button onClick={() => setCompareIds(new Set())} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: sub, fontSize: 12, cursor: 'pointer' }}>
            Clear
          </button>
        )}
        {compareIds.size > 0 && compareIds.size < 2 && (
          <span style={{ fontSize: 12, color: sub }}>Select {2 - compareIds.size} more to compare</span>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: isDark ? '#13161f' : '#f0f0f0' }}>
              <th style={{ padding: '10px 8px', color: hdr, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }} title="Select to compare">⊡</th>
              <th style={{ padding: '10px 8px', color: hdr, fontWeight: 600, fontSize: 11 }}>☆</th>
              {COL.map(c => (
                <th key={c} onClick={() => handleSort(c)} style={{ padding: '10px 14px', textAlign: 'left', color: hdr, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {LABELS[c]} {sortCol === c ? (sortDir === -1 ? '↓' : '↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COL.length + 2} style={{ padding: 24, textAlign: 'center', color: sub }}>
                  {watchlistOnly ? 'No markets in watchlist — star a row to add it.' : 'No markets to display.'}
                </td>
              </tr>
            ) : sorted.map((m, i) => {
              const isFav = favorites.has(m.id)
              const isCompare = compareIds.has(m.id)
              return (
                <tr
                  key={m.id}
                  onClick={() => onSelect(m)}
                  style={{ cursor: 'pointer', borderTop: `1px solid ${border}`, transition: 'background 0.1s', background: isCompare ? (isDark ? 'rgba(55,138,221,0.06)' : 'rgba(55,138,221,0.04)') : 'transparent' }}
                  onMouseEnter={e => { if (!isCompare) e.currentTarget.style.background = rowHover }}
                  onMouseLeave={e => { if (!isCompare) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 8px', textAlign: 'center' }} onClick={e => toggleCompare(m.id, e)}>
                    <span style={{ fontSize: 15, cursor: 'pointer', opacity: isCompare ? 1 : 0.35 }}>
                      {isCompare ? '☑' : '☐'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }} onClick={e => toggleFav(m.id, e)}>
                    <span style={{ fontSize: 15, cursor: 'pointer', color: isFav ? '#BA7517' : sub, opacity: isFav ? 1 : 0.4 }}>
                      {isFav ? '⭐' : '☆'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: sub, fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', color: txt, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: '10px 14px', color: sub }}>{m.region}</td>
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
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: getSignalBg(m.signal), color: m.signal === 'Hot' ? '#1D9E75' : m.signal === 'Rising' ? '#378ADD' : '#BA7517' }}>
                      {m.signal}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
