/**
 * Dashboard.jsx
 *
 * Early Warning / portfolio overview screen. Consumes the aggregate
 * `api.dashboardOverview(params)` endpoint and renders the credit-risk
 * snapshot: KPI tiles, risk-band counts, band trend / movement charts,
 * EWI severity, alert counts and the flagged-borrower tables.
 *
 * Visual language: the neumorphic (soft-UI) system in `dashboard.css`
 * plus the shared `--neu-*` shadow tokens in `index.css`. Raised surfaces
 * (tiles, panels) share the page's --paper tone and rely on the shadow
 * pair for depth; charts and tables sit on a flat inner surface so
 * plotting and reading stay clear.
 *
 * Risk-band palette (consistent with IFRS-9 stages elsewhere in the app):
 *   GREEN (low) -> teal, AMBER (medium) -> gold,
 *   ORANGE (elevated) -> burnt orange, RED (high) -> dark red.
 */
import { useEffect, useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Empty, Kpi, Meter, Loader } from '../components'
import { money } from '../lib/format'
import { api } from '../lib/api'
import './dashboard.css'

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 }
const GRID = 'var(--line)'

const BAND_COLOR = {
  GREEN: 'var(--teal)',
  AMBER: 'var(--warn)',
  ORANGE: '#b5651d',
  RED: 'var(--bad)',
}

const BAND_RISK_LABEL = { GREEN: 'Low', AMBER: 'Medium', ORANGE: 'Elevated', RED: 'High' }
const BAND_ORDER = ['GREEN', 'AMBER', 'ORANGE', 'RED']
/* Nudge endpoint labels apart: the three low bands often sit within a few
   pixels of each other at the right edge of the trend chart. */
const BAND_LABEL_DY = { GREEN: 0, AMBER: -3, ORANGE: 5, RED: 11 }
const bandLabel = (b) => (b ? b.charAt(0) + b.slice(1).toLowerCase() : '—')

const fmtDelta = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}% vs prior month`

/* Money values carry a zero-width space after each thousands separator so a
   long exposure wraps between groups instead of splitting a digit. */
const fmtKpiValue = (row, value) => {
  if (!row.money) return Number(value || 0).toLocaleString()
  return money(value || 0).replace(/,/g, ',\u200B')
}

const FILTERS = [
  { key: 'segment', label: 'Segment' },
  { key: 'product', label: 'Product' },
  { key: 'region', label: 'Region' },
  { key: 'industry', label: 'Industry' },
  { key: 'risk_band', label: 'Risk Band' },
]

const KPI_ROWS = [
  { key: 'total_monitored', label: 'Total Customers Monitored', goodWhen: 'up' },
  { key: 'external_credit', label: 'Customers with External Credit', goodWhen: 'up' },
  { key: 'total_kcb_exposure', label: 'Total Exposure', money: true },
  { key: 'total_external_exposure', label: 'Total External Exposure', money: true },
  { key: 'new_applications', label: 'New Credit Applications', goodWhen: 'up' },
  { key: 'new_facilities', label: 'New Facilities', goodWhen: 'up' },
  { key: 'delinquency', label: 'Customers with Delinquency', goodWhen: 'down' },
  { key: 'worsening_dpd', label: 'Worsening DPD', goodWhen: 'down' },
  { key: 'flagged_by_ewi', label: 'Flagged by EWI', goodWhen: 'down' },
]

const ALERT_LEVELS = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
]

/** Direction of a KPI delta relative to whether "up" is healthy. */
function kpiDeltaTone(delta, goodWhen) {
  if (!delta || !goodWhen) return ''
  const favorable = goodWhen === 'up' ? delta > 0 : delta < 0
  return favorable ? 'good' : 'bad'
}

/** For band counts, movement into a worse band is bad (and vice versa). */
function bandDeltaTone(band, delta) {
  if (!delta || band === 'AMBER') return ''
  const worsening = band === 'RED' || band === 'ORANGE'
  const favorable = worsening ? delta < 0 : delta > 0
  return favorable ? 'good' : 'bad'
}

function severityTone(label) {
  return { Severe: 'bad', High: 'orange', Medium: 'warn', Low: 'ok' }[label] || ''
}

/** Shared themed tooltip for both charts. */
function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null
  const format = valueFormatter || ((v) => Number(v ?? 0).toLocaleString())
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-title">{label}</div>
      {payload.map((entry) => (
        <div className="dash-tooltip-row" key={entry.dataKey ?? entry.name}>
          <span
            className="dash-tooltip-dot"
            style={{ background: entry.color || entry.payload?.fill || entry.fill }}
          />
          <span className="dash-tooltip-name">{entry.name}</span>
          <span className="dash-tooltip-value">{format(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Line dot that renders a direct label on the final point of each series. */
function makeEndDot(color, total, dy = 0) {
  const EndDot = ({ cx, cy, index, value }) => {
    if (cx == null || cy == null) return null
    const last = index === total - 1
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={last ? 5 : 3}
          fill={last ? color : 'var(--panel)'}
          stroke={color}
          strokeWidth={2}
        />
        {last && (
          <text
            x={cx + 9}
            y={cy + 4 + dy}
            fill={color}
            stroke="var(--panel)"
            strokeWidth={3}
            paintOrder="stroke"
            fontSize={11}
            fontWeight={600}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {Number(value ?? 0).toLocaleString()}
          </text>
        )}
      </g>
    )
  }
  EndDot.displayName = 'EndDot'
  return EndDot
}

/** Bar value label; transitions carry an explicit +/- sign. */
function makeBarLabel(bars) {
  const BarLabel = ({ x, y, width, height, value, index }) => {
    const negative = value < 0
    const isEndpoint = index === 0 || index === bars.length - 1
    const text = value > 0 && !isEndpoint ? `+${value.toLocaleString()}` : value.toLocaleString()
    return (
      <text
        x={x + width / 2}
        y={negative ? y - height - 5 : y - 6}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill={negative ? 'var(--ok)' : 'var(--bad)'}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    )
  }
  BarLabel.displayName = 'BarLabel'
  return BarLabel
}

export default function Dashboard({ userProfile }) {
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
  if (loading && !data) return <Loader label="Loading Dashboard…" />
  if (error) return <p className="error">{error}</p>
  if (!data) return <Empty>No Dashboard data yet for this snapshot.</Empty>

  const kpis = data.kpis || {}
  const trend = data.risk_band_trend || []
  const movement = (data.risk_movement || []).map((m) => ({
    ...m,
    fill: m.value < 0 ? 'var(--ok)' : (m.color || 'var(--bad)'),
  }))
  const severity = data.severity_distribution || []
  const topFlagged = data.top_flagged_borrowers || []
  const alerts = data.alert_counts || {}
  const queue = data.flagged_queue || []
  const months = data.available_months?.length ? data.available_months : (month ? [month] : [])

  return (
    <div className="dash">
      {/* Filter bar */}
      <section className="dash-filterbar" aria-label="Dashboard filters">
        <label className="dash-field">
          <span>Snapshot Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        {FILTERS.map((f) => (
          <label className="dash-field" key={f.key}>
            <span>{f.label}</span>
            <select
              value={filters[f.key]}
              onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
            >
              <option value="">All</option>
              {(data.filter_options?.[f.key] || []).map((opt) => (
                <option key={opt} value={opt}>
                  {f.key === 'risk_band' ? bandLabel(opt) : opt}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      {/* Primary KPIs */}
      <section className="dash-panel">
       
        <header className="dash-panel-head">
          <h2>Key indicators</h2>
        </header>
        
          <div className="dash-kpi-grid">
            {KPI_ROWS.map((row) => {
              const kpi = kpis[row.key] || {}
              const delta = kpi.delta_pct || 0
              const value = fmtKpiValue(row, kpi.value)
              return (
                <Kpi
                  key={row.key}
                  variant="neu"
                  label={row.label}
                  value={value}
                  note={fmtDelta(delta)}
                  noteTone={kpiDeltaTone(delta, row.goodWhen)}
                />
              )
            })}
         
        </div>
      </section>

      {/* Risk band counts */}
      <section className="dash-band-grid" aria-label="Customers by risk band">
        {['RED', 'ORANGE', 'AMBER', 'GREEN'].map((band) => {
          const delta = kpis.band_delta_pct?.[band] || 0
          return (
            <Kpi
              key={band}
              variant="neu"
              tag={band}
              tagTone={band.toLowerCase()}
              label={`${BAND_RISK_LABEL[band]} Risk`}
              value={(kpis.band_counts?.[band] || 0).toLocaleString()}
              note={fmtDelta(delta)}
              noteTone={bandDeltaTone(band, delta)}
            />
          )
        })}
      </section>

      {/* Charts */}
      <div className="dash-two-col">
        <section className="dash-panel">
          <header className="dash-panel-head">
            <h2>Risk band trend over time</h2>
            <span className="dash-panel-meta">by customer</span>
          </header>
          <p className="dash-panel-note">Customers by current risk band, snapshot over snapshot.</p>
          <div className="dash-panel-body">
            <div className="dash-flat dash-chart">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trend} margin={{ top: 12, right: 54, left: 0, bottom: 4 }}>
                  <defs>
                    {BAND_ORDER.map((band) => (
                      <linearGradient
                        key={band}
                        id={`dash-trend-${band.toLowerCase()}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={BAND_COLOR[band]} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={BAND_COLOR[band]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    allowDecimals={false}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: 'var(--line)', strokeWidth: 1 }}
                  />
                  {BAND_ORDER.map((band) => (
                    <Area
                      key={`area-${band}`}
                      type="monotone"
                      dataKey={band.toLowerCase()}
                      stroke="none"
                      fill={`url(#dash-trend-${band.toLowerCase()})`}
                      fillOpacity={1}
                      tooltipType="none"
                      isAnimationActive={false}
                    />
                  ))}
                  {BAND_ORDER.map((band) => (
                    <Line
                      key={band}
                      type="monotone"
                      dataKey={band.toLowerCase()}
                      name={BAND_RISK_LABEL[band]}
                      stroke={BAND_COLOR[band]}
                      strokeWidth={2}
                      dot={makeEndDot(BAND_COLOR[band], trend.length, BAND_LABEL_DY[band])}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="dash-legend">
              {BAND_ORDER.map((band) => (
                <span className="dash-legend-item" key={band}>
                  <span className="dash-legend-dot" style={{ background: BAND_COLOR[band] }} />
                  {BAND_RISK_LABEL[band]}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="dash-panel">
          <header className="dash-panel-head">
            <h2>Risk movement</h2>
            <span className="dash-panel-meta">{month}</span>
          </header>
          <p className="dash-panel-note">Customers moving across risk bands during the snapshot period.</p>
          <div className="dash-panel-body">
            <div className="dash-flat dash-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={movement} margin={{ top: 18, right: 18, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dash-move-bad" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="var(--bad)" />
                      <stop offset="100%" stopColor="#d97a5e" />
                    </linearGradient>
                    <linearGradient id="dash-move-ok" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="var(--ok)" />
                      <stop offset="100%" stopColor="#5aa386" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    interval={0}
                    angle={-24}
                    textAnchor="end"
                    height={74}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip
                    content={<ChartTooltip valueFormatter={(v) => (v > 0 ? '+' : '') + Number(v ?? 0).toLocaleString()} />}
                    cursor={{ fill: 'rgba(13, 31, 28, 0.05)' }}
                  />
                  <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.45} />
                  <Bar
                    dataKey="value"
                    name="Customers"
                    barSize={26}
                    radius={[3, 3, 0, 0]}
                    label={makeBarLabel(movement)}
                    isAnimationActive={false}
                  >
                    {movement.map((m, i) => (
                      <Cell
                        key={`${m.label}-${i}`}
                        fill={m.value < 0 ? 'url(#dash-move-ok)' : 'url(#dash-move-bad)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      {/* Severity table + Alert severity */}
      <div className="dash-two-col">
        <section className="dash-panel">
          <header className="dash-panel-head">
            <h2>EWI severity distribution</h2>
            <span className="dash-panel-meta">{month}</span>
          </header>
          <p className="dash-panel-note">Borrowers by EWI score severity, snapshot over snapshot.</p>
          <div className="dash-panel-body">
            <div className="dash-flat dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th className="right">Score range</th>
                    <th className="right">Count</th>
                    <th className="right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {severity.map((s) => (
                    <tr key={s.label}>
                      <td>{s.label}</td>
                      <td className="mono right">{s.range}</td>
                      <td className="right mono">{s.count.toLocaleString()}</td>
                      <td className="right dash-share-cell">
                        <Meter value={(s.share || 0) / 100} tone={severityTone(s.label)} neu />
                        <span className="dash-share-value">{Number(s.share || 0).toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dash-total">Total flagged: {(kpis.flagged_by_ewi?.value || 0).toLocaleString()}</p>
          </div>
        </section>

        <section className="dash-panel">
          <header className="dash-panel-head">
            <h2>Alert severity</h2>
            <span className="dash-panel-meta">open alerts</span>
          </header>
          <p className="dash-panel-note">Open alerts across the flagged population.</p>
          <div className="dash-panel-body">
            <div className="dash-alert-grid">
              {ALERT_LEVELS.map(({ key, label }) => (
                <div className="dash-alert-tile" key={key}>
                  <span className="dash-alert-label">{label} alerts</span>
                  <span className="dash-alert-value">{(alerts[key] || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Flagged borrowers */}
      <section className="dash-section">
        <h3 className="dash-section-title">Flagged borrowers</h3>
        <div className="dash-two-col">
          <section className="dash-panel">
            <header className="dash-panel-head">
              <h2>Top flagged borrowers</h2>
              <span className="dash-panel-meta">by EWI score</span>
            </header>
            <div className="dash-panel-body">
              <div className="dash-flat dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Segment</th>
                      <th className="right">EWI score</th>
                      <th>Risk band</th>
                      <th>Top EWI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFlagged.length === 0 && (
                      <tr><td className="dash-empty-cell" colSpan={5}>No flagged borrowers for this snapshot.</td></tr>
                    )}
                    {topFlagged.map((c) => (
                      <tr key={c.customer_id}>
                        <td className="mono">{c.customer_id}</td>
                        <td>{c.segment}</td>
                        <td className="right mono">{c.ewi_score}</td>
                        <td>
                          <span className={`dash-band-color ${c.risk_band?.toLowerCase() || ''}`}>
                            {bandLabel(c.risk_band)}
                          </span>
                        </td>
                        <td>{c.top_ewi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="dash-panel">
            <header className="dash-panel-head">
              <h2>Flagged borrower queue</h2>
              <span className="dash-panel-meta">actionable</span>
            </header>
            <div className="dash-panel-body">
              <div className="dash-flat dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Segment</th>
                      <th className="right">Exposure</th>
                      <th className="right">External</th>
                      <th className="right">DPD</th>
                      <th className="right">EWI</th>
                      <th>Risk band</th>
                      <th>Recommended action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.length === 0 && (
                      <tr><td className="dash-empty-cell" colSpan={8}>No borrowers in the actionable queue.</td></tr>
                    )}
                    {queue.map((c) => (
                      <tr key={c.customer_id}>
                        <td className="mono">{c.customer_id}</td>
                        <td>{c.segment}</td>
                        <td className="right mono">{money(c.kcb_exposure)}</td>
                        <td className="right mono">{money(c.external_exposure)}</td>
                        <td className="right mono">{c.current_dpd}</td>
                        <td className="right mono">{c.ewi_score}</td>
                        <td>
                          <span className={`dash-band-color ${c.risk_band?.toLowerCase() || ''}`}>
                            {bandLabel(c.risk_band)}
                          </span>
                        </td>
                        <td>{c.recommended_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
