import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import MetricCards from './components/MetricCards.jsx'
import RegionFilter from './components/RegionFilter.jsx'
import PermitChart from './components/PermitChart.jsx'
import EmploymentChart from './components/EmploymentChart.jsx'
import MarketTable from './components/MarketTable.jsx'
import MetroDrawer from './components/MetroDrawer.jsx'
import DealSignalCards from './components/DealSignalCards.jsx'
import CityIntelligence from './components/CityIntelligence.jsx'
import { useMarketData } from './hooks/useMarketData.js'

export default function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  const [selectedMetro, setSelectedMetro] = useState(null)
  const { markets, summary, loading, error, region, setRegion, refresh, lastRefreshed } = useMarketData()

  const isDark = theme === 'dark'
  const bg = isDark ? '#0F1117' : '#FFFFFF'
  const txt = isDark ? '#E8E8E8' : '#1A1A1A'

  return (
    <div style={{ minHeight: '100vh', background: bg, color: txt }}>
      <Header
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onRefresh={refresh}
        loading={loading}
        lastRefreshed={lastRefreshed}
      />

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        {error && (
          <div style={{ background: 'rgba(216,90,48,0.1)', border: '1px solid rgba(216,90,48,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#D85A30' }}>
            Error loading data: {error}. Make sure the backend is running at http://localhost:8000
          </div>
        )}

        {loading && !markets.length ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#888' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading market data...
          </div>
        ) : (
          <>
            <MetricCards summary={summary} theme={theme} />

            <div style={{ marginTop: 24 }}>
              <RegionFilter active={region} onChange={setRegion} theme={theme} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
              <PermitChart markets={markets} theme={theme} />
              <EmploymentChart markets={markets} theme={theme} />
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: txt }}>Market Heat Index</h3>
              <MarketTable markets={markets} onSelect={setSelectedMetro} theme={theme} />
            </div>

            <div style={{ marginTop: 24 }}>
              <DealSignalCards markets={markets} theme={theme} />
            </div>

            <div style={{ marginTop: 24 }}>
              <CityIntelligence theme={theme} />
            </div>
          </>
        )}
      </main>

      <MetroDrawer metro={selectedMetro} onClose={() => setSelectedMetro(null)} theme={theme} />

      <style>{`
        @media (max-width: 768px) {
          .charts-grid { grid-template-columns: 1fr !important; }
          .metric-cards { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
