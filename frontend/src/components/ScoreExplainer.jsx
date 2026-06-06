import { useState } from 'react'
import { Info, X } from 'lucide-react'

export default function ScoreExplainer({ theme }) {
  const [open, setOpen] = useState(false)
  const isDark = theme === 'dark'

  const bg = isDark ? '#1A1D2E' : '#F7F7F7'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const sub = '#888'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: `1px solid ${border}`,
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          color: sub, fontSize: 13, fontWeight: 500,
        }}
      >
        <Info size={14} /> How scores work
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
            background: isDark ? '#13161f' : '#fff',
            borderRadius: 16, zIndex: 301,
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            padding: '28px 32px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: txt, fontSize: 18, fontWeight: 700 }}>How the Composite Score Works</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub }}><X size={20} /></button>
            </div>

            {/* Score formula */}
            <div style={{ background: bg, borderRadius: 12, padding: '16px 20px', marginBottom: 20, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: sub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Composite Score Formula</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Permit Growth YoY', weight: '40%', color: '#1D9E75', desc: 'Year-over-year change in residential + commercial building permits. Permits are a leading indicator — they signal what gets built 12–18 months from now.' },
                  { label: 'Employment Growth YoY', weight: '35%', color: '#378ADD', desc: 'Year-over-year change in total employed persons from BLS Local Area Unemployment Statistics. Job growth drives housing demand.' },
                  { label: 'Population Growth YoY', weight: '25%', color: '#7F77DD', desc: 'Year-over-year population change from Census ACS estimates. Population inflow creates sustained long-term demand.' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 44, height: 44, borderRadius: 10, background: item.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.weight}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: txt }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: sub, lineHeight: 1.5, marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: isDark ? 'rgba(127,119,221,0.1)' : 'rgba(127,119,221,0.08)', borderRadius: 8, fontSize: 12, color: sub, lineHeight: 1.6 }}>
                <strong style={{ color: '#7F77DD' }}>Normalization:</strong> Each metric is converted to a 0–100 scale relative to all 24 tracked metros — so a score of 100 means best in class, and 0 means worst. The weighted average of the three normalized scores produces the final composite (0–100).
              </div>
            </div>

            {/* Signal classification */}
            <div style={{ fontSize: 13, fontWeight: 700, color: sub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Signal Classification</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { signal: 'Hot', range: 'Score ≥ 75', color: '#1D9E75', bg: 'rgba(29,158,117,0.1)', desc: 'Strong momentum across multiple indicators. Composite score ranks in the top tier of all tracked metros.' },
                { signal: 'Rising', range: 'Score 50–74', color: '#378ADD', bg: 'rgba(55,138,221,0.1)', desc: 'Positive trend but not yet at peak intensity. Markets to monitor closely for acceleration.' },
                { signal: 'Watch', range: 'Score < 50', color: '#BA7517', bg: 'rgba(186,117,23,0.1)', desc: 'Below-median performance. Could indicate a market cooling off, or an early-stage market not yet showing up in the data.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: item.bg, border: `1px solid ${item.color}33`, borderRadius: 10, padding: '12px 14px' }}>
                  <span style={{ padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800, background: item.color + '22', color: item.color, whiteSpace: 'nowrap' }}>{item.signal}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.range}</div>
                    <div style={{ fontSize: 12, color: sub, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Deal signal */}
            <div style={{ fontSize: 13, fontWeight: 700, color: sub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔥 Deal Signal Flag</div>
            <div style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: txt, lineHeight: 1.7, margin: 0 }}>
                A <strong style={{ color: '#1D9E75' }}>Deal Signal</strong> is only triggered when <strong>all three raw metrics are simultaneously positive AND each one is above its median</strong> across all 24 tracked metros. This is the highest-conviction flag — it means the market isn't just growing in one dimension, but firing on all cylinders relative to peers.
              </p>
            </div>

            {/* Example */}
            <div style={{ fontSize: 13, fontWeight: 700, color: sub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Example: How a Score of 80 is Calculated</div>
            <div style={{ background: bg, borderRadius: 10, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Permit Growth', raw: '+16%', normalized: '53', weight: '×0.40', result: '21.2', color: '#1D9E75' },
                  { label: 'Emp Growth', raw: '+7.7%', normalized: '100', weight: '×0.35', result: '35.0', color: '#378ADD' },
                  { label: 'Pop Growth', raw: '+2.9%', normalized: '97', weight: '×0.25', result: '24.3', color: '#7F77DD' },
                ].map((c, i) => (
                  <div key={i} style={{ textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '10px 8px' }}>
                    <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.raw}</div>
                    <div style={{ fontSize: 11, color: sub, marginTop: 4 }}>→ score {c.normalized}</div>
                    <div style={{ fontSize: 11, color: sub }}>{c.weight} = <strong style={{ color: txt }}>{c.result}</strong></div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 14, color: txt }}>
                21.2 + 35.0 + 24.3 = <strong style={{ color: '#7F77DD', fontSize: 18 }}>80.5</strong> → <span style={{ color: '#1D9E75', fontWeight: 700 }}>Hot</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: sub, marginTop: 4 }}>Based on Nashville–Davidson actual data</div>
            </div>

          </div>
        </>
      )}
    </>
  )
}
