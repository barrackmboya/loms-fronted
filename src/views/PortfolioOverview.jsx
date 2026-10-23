import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Empty, Loader } from '../components'
import { money } from '../lib/format'
import { api } from '../lib/api'
import './PortfolioOverview.css'

const BAND_COLOR = {
  GREEN: '#36c9a5',
  AMBER: '#f6c453',
  ORANGE: '#ff9b65',
  RED: '#ff647c',
}
const BAND_RISK_LABEL = { GREEN: 'Low', AMBER: 'Moderate', ORANGE: 'Elevated', RED: 'High' }
const FILTERS = [
  { key: 'segment', label: 'Segment' },
  { key: 'product', label: 'Product' },
  { key: 'region', label: 'Region' },
  { key: 'industry', label: 'Industry' },
  { key: 'risk_band', label: 'Risk band' },
]
const AXIS = { stroke: '#8d9bad', fontSize: 11, tickLine: false, axisLine: false }
const GRID = 'rgba(148, 163, 184, .14)'
const bandLabel = (band = '') => band ? band.charAt(0) + band.slice(1).toLowerCase() : 'Unknown'
const fmt = (value) => Number(value ?? 0).toLocaleString()
const fmtDelta = (value) => {
  const delta = Number(value ?? 0)
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs prior month`
}
const safeArray = (value) => Array.isArray(value) ? value : []

function Icon({ name }) {
  const icons = {
    portfolio: '▤', customers: '♙', exposure: '◈', applications: '↗',
    facilities: '▣', delinquency: '◷', warning: '△', filter: '☷',
    refresh: '↻', risk: '◉', activity: '⌁', alert: '!',
  }
  return <span className="po-icon" aria-hidden="true">{icons[name] || '•'}</span>
}

function MetricCard({ label, value, delta, icon, tone = 'teal', detail }) {
  const deltaValue = Number(delta ?? 0)
  return (
    <article className={`po-metric po-tone-${tone}`}>
      <div className="po-metric-top">
        <span className="po-metric-label">{label}</span>
        <span className="po-metric-icon"><Icon name={icon} /></span>
      </div>
      <div className="po-metric-value">{value}</div>
      <div className="po-metric-foot">
        <span className={`po-delta ${deltaValue > 0 ? 'is-up' : deltaValue < 0 ? 'is-down' : ''}`}>
          {deltaValue > 0 ? '↗' : deltaValue < 0 ? '↘' : '—'} {fmtDelta(deltaValue)}
        </span>
        {detail && <span className="po-metric-detail">{detail}</span>}
      </div>
    </article>
  )
}

function SectionHeading({ eyebrow, title, description, right }) {
  return (
    <div className="po-section-heading">
      <div>
        {eyebrow && <div className="po-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {right && <div className="po-section-right">{right}</div>}
    </div>
  )
}

function RiskPill({ band }) {
  const key = String(band || 'UNKNOWN').toUpperCase()
  return <span className={`po-risk-pill po-risk-${key.toLowerCase()}`}><i />{bandLabel(key)}</span>
}

function Panel({ className = '', children }) {
  return <section className={`po-panel ${className}`}>{children}</section>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="po-tooltip">
      {label && <div className="po-tooltip-label">{label}</div>}
      {payload.map((item, index) => (
        <div className="po-tooltip-row" key={`${item.dataKey}-${index}`}>
          <span className="po-tooltip-dot" style={{ background: item.color || item.fill }} />
          <span>{item.name || item.dataKey}</span>
          <strong>{fmt(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function PortfolioOverview({ userProfile }) {
  const [month, setMonth] = useState('')
  const [filters, setFilters] = useState({ segment: '', product: '', region: '', industry: '', risk_band: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const hasAccess = userProfile?.accessible_modules?.includes('dashboard') ?? false
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  )

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = { month: month || undefined, ...filters }
        const result = await api.dashboardOverview(params)
        if (cancelled) return
        setData(result || null)
        if (!month && result?.snapshot_month) setMonth(result.snapshot_month)
      } catch (e) {
        if (!cancelled) setError(`Failed to load portfolio overview: ${e?.message || 'Unknown error'}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [hasAccess, month, filters])

  if (!hasAccess) return <Empty>You don't have access to the Dashboard module.</Empty>
  if (loading && !data) return <Loader label="Loading executive portfolio dashboard…" />
  if (!data && error) return <div className="po-state po-state-error"><Icon name="alert" /><div><strong>Dashboard unavailable</strong><p>{error}</p></div></div>
  if (!data) return <Empty>No dashboard data is available for this snapshot.</Empty>

  const kpis = data.kpis || {}
  const trend = safeArray(data.risk_band_trend)
  const movement = safeArray(data.risk_movement)
  const severity = safeArray(data.severity_distribution)
  const topFlagged = safeArray(data.top_flagged_borrowers)
  const alerts = data.alert_counts || {}
  const queue = safeArray(data.flagged_queue)
  const availableMonths = safeArray(data.available_months)
  const monthLabel = month || data.snapshot_month || 'Latest snapshot'

  const primaryMetrics = [
    { label: 'Customers monitored', value: fmt(kpis.total_monitored?.value), delta: kpis.total_monitored?.delta_pct, icon: 'customers', tone: 'teal' },
    { label: 'KCB portfolio exposure', value: money(kpis.total_kcb_exposure?.value || 0), delta: kpis.total_kcb_exposure?.delta_pct, icon: 'exposure', tone: 'blue' },
    { label: 'External credit exposure', value: money(kpis.total_external_exposure?.value || 0), delta: kpis.total_external_exposure?.delta_pct, icon: 'portfolio', tone: 'violet' },
    { label: 'Customers in delinquency', value: fmt(kpis.delinquency?.value), delta: kpis.delinquency?.delta_pct, icon: 'delinquency', tone: 'rose' },
  ]
  const secondaryMetrics = [
    { label: 'External credit customers', value: fmt(kpis.external_credit?.value), delta: kpis.external_credit?.delta_pct, icon: 'customers', tone: 'blue' },
    { label: 'New applications', value: fmt(kpis.new_applications?.value), delta: kpis.new_applications?.delta_pct, icon: 'applications', tone: 'violet' },
    { label: 'New facilities', value: fmt(kpis.new_facilities?.value), delta: kpis.new_facilities?.delta_pct, icon: 'facilities', tone: 'teal' },
    { label: 'Worsening DPD', value: fmt(kpis.worsening_dpd?.value), delta: kpis.worsening_dpd?.delta_pct, icon: 'warning', tone: 'amber' },
    { label: 'Flagged by EWI', value: fmt(kpis.flagged_by_ewi?.value), delta: kpis.flagged_by_ewi?.delta_pct, icon: 'alert', tone: 'rose' },
  ]

  return (
    <main className="po-dashboard">
      <header className="po-hero">
        <div className="po-hero-orb po-orb-one" />
        <div className="po-hero-orb po-orb-two" />
        <div className="po-hero-content">
          <div className="po-breadcrumb"><span>INTELLIGENCE</span><b>/</b><span>PORTFOLIO OVERVIEW</span></div>
          <div className="po-hero-title-row">
            <div>
              <div className="po-live-label"><span /> CREDIT RISK COMMAND CENTRE</div>
              <h1>Portfolio <span>Overview</span></h1>
              <p>A clear, forward-looking view of portfolio health, risk movement and emerging exposure.</p>
            </div>
            <div className="po-snapshot">
              <span className="po-snapshot-label">REPORTING SNAPSHOT</span>
              <strong>{monthLabel}</strong>
              <span className={`po-sync ${loading ? 'is-loading' : ''}`}><i />{loading ? 'Updating data' : 'Data up to date'}</span>
            </div>
          </div>
          <div className="po-hero-stats">
            <div><span>High-risk customers</span><strong>{fmt(kpis.band_counts?.RED)}</strong></div>
            <div><span>Elevated-risk customers</span><strong>{fmt(kpis.band_counts?.ORANGE)}</strong></div>
            <div><span>Open critical alerts</span><strong>{fmt(alerts.critical)}</strong></div>
            <div><span>Early-warning flags</span><strong>{fmt(kpis.flagged_by_ewi?.value)}</strong></div>
          </div>
        </div>
      </header>

      {error && <div className="po-inline-error"><Icon name="alert" />{error} <span>Showing the last successfully loaded snapshot.</span></div>}

      <Panel className="po-filter-panel">
        <div className="po-filter-heading">
          <div className="po-filter-title"><span className="po-filter-symbol"><Icon name="filter" /></span><div><strong>Refine your view</strong><small>Filter the portfolio snapshot by business dimension</small></div></div>
          <div className="po-filter-actions">
            {activeFilterCount > 0 && <span className="po-filter-count">{activeFilterCount} active</span>}
            <button className="po-reset-button" type="button" onClick={() => setFilters({ segment: '', product: '', region: '', industry: '', risk_band: '' })}>Reset filters</button>
          </div>
        </div>
        <div className="po-filter-grid">
          <label className="po-field"><span>Snapshot month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {month && !availableMonths.includes(month) && <option value={month}>{month}</option>}
              {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {FILTERS.map((filter) => (
            <label className="po-field" key={filter.key}><span>{filter.label}</span>
              <select value={filters[filter.key]} onChange={(e) => setFilters((old) => ({ ...old, [filter.key]: e.target.value }))}>
                <option value="">All {filter.label.toLowerCase()}s</option>
                {safeArray(data.filter_options?.[filter.key]).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
      </Panel>

      <div className="po-section-intro"><div><div className="po-eyebrow">01 / PORTFOLIO HEALTH</div><h2>Executive indicators</h2></div><span>Compared with the previous month</span></div>
      <div className="po-metric-grid po-primary-grid">
        {primaryMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="po-metric-grid po-secondary-grid">
        {secondaryMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="po-section-intro po-section-spaced"><div><div className="po-eyebrow">02 / RISK INTELLIGENCE</div><h2>Risk profile & movement</h2></div><span>Snapshot: {monthLabel}</span></div>
      <div className="po-chart-grid">
        <Panel>
          <SectionHeading eyebrow="PORTFOLIO TREND" title="Risk bands over time" description="Customer distribution across risk levels, snapshot by snapshot." right={<span className="po-chart-chip"><Icon name="activity" /> Trend</span>} />
          {trend.length ? <div className="po-chart"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 12, right: 10, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" {...AXIS} tickMargin={12} />
              <YAxis {...AXIS} tickFormatter={fmt} width={58} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              {['GREEN', 'AMBER', 'ORANGE', 'RED'].map((band) => <Line key={band} type="monotone" dataKey={band.toLowerCase()} name={`${bandLabel(band)} risk`} stroke={BAND_COLOR[band]} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />)}
            </LineChart>
          </ResponsiveContainer></div> : <div className="po-chart-empty">No risk trend data for this snapshot.</div>}
        </Panel>
        <Panel>
          <SectionHeading eyebrow="PERIOD-ON-PERIOD" title="Risk movement" description="Net movement in customers across risk bands." right={<span className="po-chart-chip">{monthLabel}</span>} />
          {movement.length ? <div className="po-chart"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={movement} margin={{ top: 12, right: 8, left: -12, bottom: 22 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" {...AXIS} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis {...AXIS} tickFormatter={fmt} width={58} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Customers" radius={[6, 6, 0, 0]} maxBarSize={46}>
                {movement.map((item, index) => <Cell key={`${item.label}-${index}`} fill={item.value < 0 ? BAND_COLOR.GREEN : (item.color || BAND_COLOR.RED)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div> : <div className="po-chart-empty">No risk movement data for this snapshot.</div>}
        </Panel>
      </div>

      <div className="po-section-intro po-section-spaced"><div><div className="po-eyebrow">03 / EARLY WARNING</div><h2>Signals requiring attention</h2></div><span>Prioritise by severity and urgency</span></div>
      <div className="po-insight-grid">
        <Panel>
          <SectionHeading title="EWI severity distribution" description="How flagged customers are distributed by severity." />
          {severity.length ? <div className="po-table-wrap"><table className="po-table">
            <thead><tr><th>Severity</th><th>Score range</th><th className="po-right">Customers</th><th>Share</th></tr></thead>
            <tbody>{severity.map((item, index) => <tr key={`${item.label}-${index}`}>
              <td><span className="po-severity-name"><i className={`po-severity-dot po-severity-${String(item.label).toLowerCase()}`} />{item.label}</span></td>
              <td><span className="po-score-range">{item.range ?? '—'}</span></td>
              <td className="po-right po-number">{fmt(item.count)}</td>
              <td><div className="po-share-cell"><div className="po-share-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(item.share) || 0))}%` }} /></div><small>{Number(item.share || 0).toFixed(1)}%</small></div></td>
            </tr>)}</tbody>
          </table></div> : <div className="po-table-empty">No EWI severity data available.</div>}
          <div className="po-panel-foot"><span>Total customers flagged by EWI</span><strong>{fmt(kpis.flagged_by_ewi?.value)}</strong></div>
        </Panel>
        <Panel className="po-alert-panel">
          <SectionHeading eyebrow="LIVE PRIORITY VIEW" title="Open alert severity" description="Alerts across the currently flagged population." />
          <div className="po-alert-stack">
            {[
              { key: 'critical', label: 'Critical', hint: 'Immediate review', color: 'critical' },
              { key: 'high', label: 'High', hint: 'Urgent follow-up', color: 'high' },
              { key: 'medium', label: 'Medium', hint: 'Monitor closely', color: 'medium' },
              { key: 'low', label: 'Low', hint: 'Routine monitoring', color: 'low' },
            ].map((item) => <div className="po-alert-row" key={item.key}>
              <span className={`po-alert-marker ${item.color}`}><Icon name="alert" /></span>
              <div className="po-alert-copy"><strong>{item.label}</strong><small>{item.hint}</small></div>
              <strong className="po-alert-count">{fmt(alerts[item.key])}</strong>
            </div>)}
          </div>
          <div className="po-alert-footer"><span className="po-alert-pulse" />Risk alerts need review against the latest snapshot.</div>
        </Panel>
      </div>

      <div className="po-section-intro po-section-spaced"><div><div className="po-eyebrow">04 / DECISION SUPPORT</div><h2>Priority borrowers</h2></div><span>{topFlagged.length.toLocaleString()} records in the top flagged view</span></div>
      <Panel className="po-table-panel">
        <SectionHeading title="Top flagged borrowers" description="Customers with the highest early-warning priority in this snapshot." right={<span className="po-table-count">{topFlagged.length} records</span>} />
        <div className="po-table-wrap"><table className="po-table">
          <thead><tr><th>Customer ID</th><th>Segment</th><th className="po-right">EWI score</th><th>Risk band</th><th>Leading warning signal</th></tr></thead>
          <tbody>{topFlagged.length ? topFlagged.map((customer) => <tr key={customer.customer_id}>
            <td className="po-customer-id">{customer.customer_id || '—'}</td><td>{customer.segment || '—'}</td><td className="po-right po-number">{fmt(customer.ewi_score)}</td><td><RiskPill band={customer.risk_band} /></td><td>{customer.top_ewi || '—'}</td>
          </tr>) : <tr><td colSpan="5" className="po-empty-cell">No flagged borrowers in this view.</td></tr>}</tbody>
        </table></div>
      </Panel>

      <Panel className="po-table-panel po-queue-panel">
        <SectionHeading eyebrow="ACTION QUEUE" title="Flagged borrower worklist" description="A practical queue for follow-up, review and risk mitigation." right={<span className="po-table-count">{queue.length} actions</span>} />
        <div className="po-table-wrap"><table className="po-table po-wide-table">
          <thead><tr><th>Customer ID</th><th>Segment</th><th className="po-right">KCB exposure</th><th className="po-right">External exposure</th><th className="po-right">DPD</th><th className="po-right">EWI count</th><th className="po-right">EWI score</th><th>Risk</th><th>Recommended action</th></tr></thead>
          <tbody>{queue.length ? queue.map((customer) => <tr key={customer.customer_id}>
            <td className="po-customer-id">{customer.customer_id || '—'}</td><td>{customer.segment || '—'}</td><td className="po-right po-number">{money(customer.kcb_exposure || 0)}</td><td className="po-right po-number">{money(customer.external_exposure || 0)}</td><td className="po-right po-number">{fmt(customer.current_dpd)}</td><td className="po-right po-number">{fmt(customer.ewi_count)}</td><td className="po-right po-number">{fmt(customer.ewi_score)}</td><td><RiskPill band={customer.risk_band} /></td><td className="po-action-cell">{customer.recommended_action || 'Review customer profile'}</td>
          </tr>) : <tr><td colSpan="9" className="po-empty-cell">The actionable queue is clear for the selected filters.</td></tr>}</tbody>
        </table></div>
      </Panel>
      <footer className="po-footer"><span>PORTFOLIO INTELLIGENCE</span><span>Internal decision-support view · Snapshot: {monthLabel}</span></footer>
    </main>
  )
}
