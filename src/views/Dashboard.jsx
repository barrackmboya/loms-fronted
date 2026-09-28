/**
 * PortfoliOverview.jsx
 *
 * Early Warning / portfolio overview screen — mirrors Portfolio.jsx's
 * structure and CSS classes (`panel`, `soft`, `note`, `mono`, `right`,
 * `inset`, `grid`, `error`) and its module-permission pattern
 * (`userProfile.accessible_modules`), so it drops into the same shell.
 *
 * Assumes a single aggregate endpoint, added to lib/api.js:
 *
 *   dashboardOverview: (params) => request('/api/dashboard/overview/', { params }),
 *
 * backed by the Django app in the accompanying dashboard_app/ files. The
 * shape it returns is documented inline below, next to where each
 * field is consumed.
 *
 * Color scheme is pulled from the existing IFRS-9 stage palette so
 * risk bands read consistently with the rest of the app:
 *   GREEN (low) -> teal, AMBER (medium) -> gold,
 *   ORANGE (elevated) -> burnt orange, RED (high) -> dark red.
 *
 * Layout note: the whole screen is widened to 98vw (and re-centered
 * with a negative margin so it isn't skewed by any max-width/padding
 * on a parent container) to give the KPI grid, charts, and tables more
 * breathing room. Every inner grid/panel that previously pinned itself
 * to width: '100%' now simply fills that wider outer container.
 */
import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Empty, Kpi, Meter } from '../components'
import { money } from '../lib/format'
import { api } from '../lib/api'

const AXIS = { stroke: '#5d6b66', fontSize: 12 }
const GRID = '#e1e6e2'

const BAND_COLOR = {
  GREEN: '#176b63',
  AMBER: '#c08a1e',
  ORANGE: '#b5651d',
  RED: '#9e2b2b',
}

const BAND_RISK_LABEL = { GREEN: 'Low', AMBER: 'Medium', ORANGE: 'Elevated', RED: 'High' }
const bandLabel = (b) => b.charAt(0) + b.slice(1).toLowerCase()

const fmtDelta = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}% vs prior month`

const FILTERS = [
  { key: 'segment', label: 'Segment' },
  { key: 'product', label: 'Product' },
  { key: 'region', label: 'Region' },
  { key: 'industry', label: 'Industry' },
  { key: 'risk_band', label: 'Risk Band' },
]

const FULL_WIDTH_GRID = { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', width: '100%' }

// Break the whole screen out to 98vw and re-center it, regardless of
// whatever max-width/padding the parent shell applies.
const PAGE_WIDE = {
  width: '98vw',
  maxWidth: '98vw',
  marginLeft: 'calc(-49vw + 50%)',
  boxSizing: 'border-box',
}

export default function PortfoliOverview({ userProfile }) {
  const [month, setMonth] = useState('')
  const [filters, setFilters] = useState({ segment: '', product: '', region: '', industry: '', risk_band: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const hasAccess = userProfile?.accessible_modules?.includes('dashboard') ?? false

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = { month: month || undefined, ...filters }
        const result = await api.dashboardOverview(params)
        if (!cancelled) {
          setData(result)
          if (!month && result?.snapshot_month) setMonth(result.snapshot_month)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(`Failed to load portfolio overview: ${e.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, month, filters])

  if (!hasAccess) return <Empty>You don't have access to the Dashboard module.</Empty>
  if (loading && !data) return <Empty>Loading Dashboard…</Empty>
  if (error) return <p className="error">{error}</p>
  if (!data) return <Empty>No Dashboard data yet for this snapshot.</Empty>

  const kpis = data.kpis || {}
  const trend = data.risk_band_trend || []
  const movement = data.risk_movement || []
  const severity = data.severity_distribution || []
  const topFlagged = data.top_flagged_borrowers || []
  const alerts = data.alert_counts || {}
  const queue = data.flagged_queue || []

  return (
    <div className="grid" style={PAGE_WIDE}>
      {/* Filter bar */}
      <div className="panel">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <label>
            <div className="note">Snapshot Month</div>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {(data.available_months || [month]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          {FILTERS.map((f) => (
            <label key={f.key}>
              <div className="note">{f.label}</div>
              <select
                value={filters[f.key]}
                onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
              >
                <option value="">All</option>
                {(data.filter_options?.[f.key] || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid" style={FULL_WIDTH_GRID}>
        <Kpi label="Total Customers Monitored" value={(kpis.total_monitored?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.total_monitored?.delta_pct || 0)} />
        <Kpi label="Customers with External Credit" value={(kpis.external_credit?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.external_credit?.delta_pct || 0)} />
        <Kpi label="Total KCB Exposure" value={money(kpis.total_kcb_exposure?.value || 0)} note={fmtDelta(kpis.total_kcb_exposure?.delta_pct || 0)} />
        <Kpi label="Total External Exposure" value={money(kpis.total_external_exposure?.value || 0)} note={fmtDelta(kpis.total_external_exposure?.delta_pct || 0)} />
        <Kpi label="New Credit Applications" value={(kpis.new_applications?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.new_applications?.delta_pct || 0)} />
        <Kpi label="New Facilities" value={(kpis.new_facilities?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.new_facilities?.delta_pct || 0)} />
        <Kpi label="Customers with Delinquency" value={(kpis.delinquency?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.delinquency?.delta_pct || 0)} />
        <Kpi label="Worsening DPD" value={(kpis.worsening_dpd?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.worsening_dpd?.delta_pct || 0)} />
        <Kpi label="Flagged by EWI" value={(kpis.flagged_by_ewi?.value ?? 0).toLocaleString()} note={fmtDelta(kpis.flagged_by_ewi?.delta_pct || 0)} />
      </div>

      {/* Risk band counts */}
      <div className="grid" style={FULL_WIDTH_GRID}>
        {['RED', 'ORANGE', 'AMBER', 'GREEN'].map((band) => (
          <Kpi
            key={band}
            label={`${bandLabel(band)} (${BAND_RISK_LABEL[band]} Risk)`}
            value={(kpis.band_counts?.[band] || 0).toLocaleString()}
            note={fmtDelta(kpis.band_delta_pct?.[band] || 0)}
          />
        ))}
      </div>

      <div className="grid cols-2" style={{ width: '100%' }}>
        <div className="panel">
          <h2>Risk band trend over time (by customer)</h2>
          <p className="note">Customers by current risk band, snapshot over snapshot.</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" {...AXIS} />
              <YAxis {...AXIS} width={60} tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {['GREEN', 'AMBER', 'ORANGE', 'RED'].map((band) => (
                <Line
                  key={band}
                  type="monotone"
                  dataKey={band.toLowerCase()}
                  name={bandLabel(band)}
                  stroke={BAND_COLOR[band]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Risk movement ({month})</h2>
          <p className="note">Customers moving across risk bands during the snapshot period.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={movement}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" {...AXIS} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis {...AXIS} width={60} tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="value">
                {movement.map((m, i) => (
                  <Cell key={i} fill={m.value < 0 ? BAND_COLOR.GREEN : (m.color || BAND_COLOR.RED)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid cols-2" style={{ width: '100%' }}>
        <div className="panel">
          <h2>EWI severity distribution ({month})</h2>
          <table>
            <thead>
              <tr><th>Severity</th><th>Score range</th><th className="right">Count</th><th>Share</th></tr>
            </thead>
            <tbody>
              {severity.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td className="mono">{s.range}</td>
                  <td className="right mono">{s.count.toLocaleString()}</td>
                  <td style={{ width: 160 }}><Meter value={s.share} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Total flagged: {(kpis.flagged_by_ewi?.value || 0).toLocaleString()}</p>
        </div>

        <div className="soft">
          <h2>Alert severity</h2>
          <p className="note">Open alerts across the flagged population.</p>
          <div className="inset grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            {['critical', 'high', 'medium', 'low'].map((k) => (
              <div key={k}>
                <div className="note">{k.charAt(0).toUpperCase() + k.slice(1)} alerts</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{(alerts[k] || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ width: '100%' }}>
        <h2>Top flagged borrowers</h2>
        <table>
          <thead>
            <tr><th>Customer ID</th><th>Segment</th><th className="right">EWI score</th><th>Risk band</th><th>Top EWI</th></tr>
          </thead>
          <tbody>
            {topFlagged.map((c) => (
              <tr key={c.customer_id}>
                <td className="mono">{c.customer_id}</td>
                <td>{c.segment}</td>
                <td className="right mono">{c.ewi_score}</td>
                <td><span style={{ color: BAND_COLOR[c.risk_band], fontWeight: 600 }}>{bandLabel(c.risk_band)}</span></td>
                <td>{c.top_ewi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ width: '100%' }}>
        <h2>Flagged borrower queue (actionable)</h2>
        <table>
          <thead>
            <tr>
              <th>Customer ID</th><th>Segment</th><th className="right">KCB exposure</th>
              <th className="right">External exposure</th><th className="right">DPD</th>
              <th className="right">EWI count</th><th className="right">EWI score</th>
              <th>Risk band</th><th>Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((c) => (
              <tr key={c.customer_id}>
                <td className="mono">{c.customer_id}</td>
                <td>{c.segment}</td>
                <td className="right mono">{money(c.kcb_exposure)}</td>
                <td className="right mono">{money(c.external_exposure)}</td>
                <td className="right mono">{c.current_dpd}</td>
                <td className="right mono">{c.ewi_count}</td>
                <td className="right mono">{c.ewi_score}</td>
                <td><span style={{ color: BAND_COLOR[c.risk_band], fontWeight: 600 }}>{bandLabel(c.risk_band)}</span></td>
                <td>{c.recommended_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}