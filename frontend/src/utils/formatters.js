export const fmtPct = (v) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
export const fmtScore = (v) => v == null ? '—' : Math.round(v).toString()
export const fmtNum = (v) => v == null ? '—' : v.toLocaleString()
export const fmtCurrency = (v) => v == null ? '—' : `$${Math.round(v / 1000)}k`
export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
