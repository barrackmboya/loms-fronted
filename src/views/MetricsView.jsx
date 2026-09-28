import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money, pct } from '../lib/format'
import { Empty, Kpi } from '../components'
import { Code, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

const AXIS_STYLE = { stroke: '#5d6b66', fontSize: 11 }
const BAND_ORDER = ['GREEN', 'AMBER', 'RED', 'STAGE1', 'STAGE2', 'STAGE3']
const BAND_COLORS = {
  GREEN: '#10b981', AMBER: '#f59e0b', RED: '#ef4444',
  STAGE1: '#10b981', STAGE2: '#f59e0b', STAGE3: '#ef4444',
}
const DEFAULT_COLORS = ['#176b63', '#c08a1e', '#9e2b2b', '#2563eb', '#7c3aed', '#0891b2']

// Key-name heuristics used only for fields that arrive as bare numbers with no
// declared unit (i.e. sub-fields of a composite metric object).
const COUNT_KEY_RE = /(^|_)(accounts?|count|num|n|records?)($|_)/i
const PERCENT_KEY_RE = /pct|percent|coverage|rate|ratio|par ?30|par ?90/i
const CURRENCY_KEY_RE = /book|ecl|stock|balance|amount|limit|price|exposure|stage ?1$|stage ?2$\vert{}stage ?3$/i

const ACRONYMS = new Set(['dq', 'ecl', 'kyc', 'ews', 'par', 'id', 'mob', 'stp', 'sicr'])

export default function MetricsView({ userProfile = null }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState('origination')
  const [showRaw, setShowRaw] = useState(false)

  const moduleConfig2 = {
    origination: { fn: api.originationMetrics, name: 'Origination' },
    parties: { fn: api.partiesMetrics, name: 'Parties (KYC & Identity)' },
    decisioning: { fn: api.decisioningMetrics, name: 'Decisioning' },
    servicing: { fn: api.servicingMetrics, name: 'Servicing' },
    provisioning: { fn: api.provisioningMetrics, name: 'Provisioning' },
    monitoring: { fn: api.monitoringMetrics, name: 'Monitoring' },
    recovery: { fn: api.recoveryMetrics, name: 'Recovery & Collections' },
  }

    const moduleConfig = {
    origination: { fn: api.originationMetrics, name: 'Origination' },
    parties: { fn: api.partiesMetrics, name: 'Parties (KYC & Identity)' },
    decisioning: { fn: api.decisioningMetrics, name: 'Decisioning' },
    servicing: { fn: api.servicingMetrics, name: 'Servicing' },
    provisioning: { fn: api.provisioningMetrics, name: 'Provisioning' },
    monitoring: { fn: api.monitoringMetrics, name: 'Monitoring' },
    recovery: { fn: api.recoveryMetrics, name: 'Recovery & Collections' },
  }

  const config = moduleConfig[selectedModule]

  // Check if user has access to a given module key
const canAccessModule = (moduleKey) => {
    if (!userProfile) return true;

    // Check admin/superuser flags
    if (
      userProfile.is_superuser ||
      userProfile.is_staff ||
      userProfile.is_admin ||
      userProfile.role === 'admin' ||
      userProfile.role === 'superuser'
    ) {
      return true;
    }

    if (!userProfile.accessible_modules || !Array.isArray(userProfile.accessible_modules)) {
      return true;
    }

    const allowed = userProfile.accessible_modules.map((m) => String(m).toLowerCase());

    // If user has the global 'metrics' feature module access, allow all metrics sub-modules
    if (allowed.includes('metrics')) {
      return true;
    }

    // Otherwise check exact sub-module permission match
    return allowed.includes(moduleKey.toLowerCase());
  };

  const hasModuleAccess = () => canAccessModule(selectedModule);

  useEffect(() => {
    if (!config) {
      setError(`Unknown module: ${selectedModule}`)
      setLoading(false)
      return
    }

    // Check module access
    if (!hasModuleAccess()) {
      setError('Access denied: You do not have permission to view this module');
      setLoading(false);
      setData(null);
      return;
    }

    const loadMetrics = async () => {
      try {
        setLoading(true)
        setShowRaw(false)
        const result = await config.fn()
        setData(result)
        setError(null)
      } catch (e) {
        setError(`Can't reach the API. (${e.message})`)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [selectedModule, userProfile])

  // Build module dropdown options filtered by user permissions
  const moduleOptions = Object.entries(moduleConfig)
    .map(([key, value]) => ({
      value: key,
      label: value.name,
    }))
    .filter(({ value }) => canAccessModule(value));

  if (loading) return <p className="p-6">Loading {config?.name || 'module'} metrics…</p>
  if (error) return <p className="error p-6">{error}</p>
  if (!data) return <Empty>No metrics data available</Empty>

  const formattedMetrics = formatMetricsForDisplay(data.metrics || {})

  const kpiAccents = [
    { label: 'Total Metrics', value: data.summary?.total_metrics ?? 0, color: '#176b63' },
    { label: 'Healthy', value: data.summary?.healthy_count ?? 0, note: 'metrics', color: '#10b981' },
    { label: 'Warnings', value: data.summary?.warning_count ?? 0, note: 'metrics', color: '#f59e0b' },
    { label: 'Critical', value: data.summary?.critical_count ?? 0, note: 'metrics', color: '#ef4444' },
  ]

  return (
    <div className="w-full px-4 sm:px-8 py-6 space-y-6">
      {/* Module Navigation & Header */}
      <div className="panel w-full">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">{config.name} Metrics</h2>
          <div className="select">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              disabled={!hasModuleAccess()}
            >
              {moduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="note">Real-time analytics &amp; status monitoring for {config.name.toLowerCase()}.</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid cols-4 w-full">
        {kpiAccents.map((k) => (
          <div key={k.label} style={{ borderTop: `3px solid ${k.color}`, borderRadius: 8 }}>
            <Kpi label={k.label} value={k.value} note={k.note} />
          </div>
        ))}
      </div>

      {/* Categorized Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {Object.entries(formattedMetrics).map(([category, metrics]) => (
          <div key={category} className="soft w-full flex flex-col justify-between">
            <div>
              <h2>{category}</h2>

              {metrics.length > 0 ? (
                <div className="inset space-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.key} className="border-b border-gray-200/50 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="font-medium text-gray-800">{metric.label}</div>
                          {metric.description && (
                            <p className="note text-xs" style={{ marginTop: '2px', marginBottom: 0 }}>
                              {metric.description}
                            </p>
                          )}
                        </div>

                        {typeof metric.rawVal !== 'object' && (
                          <div className="right mono whitespace-nowrap pl-2">
                            <span style={{ fontSize: '1.05em', fontWeight: 600 }}>
                              {metric.formattedValue}
                            </span>
                            {metric.unit && metric.unit !== 'distribution' && (
                              <span className="note text-xs" style={{ marginLeft: '4px' }}>
                                {metric.unit}
                              </span>
                            )}
                            <TrendBadge trend={metric.trend} />
                          </div>
                        )}
                      </div>

                      {typeof metric.rawVal === 'object' && metric.rawVal !== null && (
                        <div className="mt-3">
                          <MetricChartRenderer rawVal={metric.rawVal} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="note" style={{ margin: 0 }}>No metrics in this category</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Raw Payload */}
      <div className="pt-2 w-full">
        <button className="btn ghost" onClick={() => setShowRaw((s) => !s)}>
          <Code size={16} /> {showRaw ? 'Hide raw data' : 'View raw data'}
        </button>
        {showRaw && (
          <pre
            className="mono text-xs"
            style={{
              marginTop: 8, padding: 12, background: '#f6f8f7',
              border: '1px solid #e1e6e2', borderRadius: 8,
              maxHeight: 320, overflow: 'auto',
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function TrendBadge({ trend }) {
  if (!trend || trend === 'unknown') return null
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  return (
    <span className={`metric-trend trend-${trend}`} style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}>
      <Icon size={13} />
    </span>
  )
}

/* ---------------------------------------------------------------------- */
/* Metric value rendering                                                  */
/* ---------------------------------------------------------------------- */

function MetricChartRenderer({ rawVal }) {
  if (Array.isArray(rawVal)) return <VintageChart data={rawVal} />

  if (rawVal && typeof rawVal === 'object') {
    if (isDistributionMap(rawVal)) return <DistributionChart data={rawVal} />
    return <CompositeMetric obj={rawVal} />
  }

  return null
}

function VintageChart({ data }) {
  const chartData = data.map((item) => ({
    mob: item.mob !== undefined ? `MOB ${item.mob}` : item.label || 'N/A',
    dq: item.dq30_pct !== undefined ? item.dq30_pct * 100 : item.value ?? item.count ?? 0,
  }))

  return (
    <div className="w-full pt-1">
      <p className="text-xs font-semibold text-gray-500 mb-2">Vintage Delinquency Trend (%)</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e6e2" />
          <XAxis dataKey="mob" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} unit="%" width={35} />
          <Tooltip formatter={(val) => [`${Number(val).toFixed(1)}%`, '30+ DPD']} />
          <Line type="monotone" dataKey="dq" stroke="#b07d2b" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function isDistributionMap(obj) {
  const entries = Object.entries(obj)
  if (entries.length < 1 || entries.length > 8) return false
  return entries.every(([, v]) => {
    if (Array.isArray(v)) return false
    if (v && typeof v === 'object') return 'count' in v || 'value' in v || 'percentage' in v
    return typeof v === 'number'
  })
}

function magnitudeOf(v) {
  if (v && typeof v === 'object') return v.count ?? v.value ?? v.percentage ?? 0
  return typeof v === 'number' ? v : 0
}

function magnitudeTypeOf(entries) {
  const nums = entries.map(([, v]) => magnitudeOf(v)).filter((n) => typeof n === 'number')
  if (nums.length === 0) return 'count'
  if (nums.every((n) => n >= 0 && n <= 1)) return 'percent'
  if (nums.some((n) => Math.abs(n) >= 1000)) return 'currency'
  return 'count'
}

function formatByMagnitude(v, type) {
  if (typeof v !== 'number') return String(v)
  if (type === 'percent') return pct(v)
  if (type === 'currency') return money(v)
  return v.toLocaleString()
}

function formatDistValue(v, magType) {
  if (v && typeof v === 'object') {
    if ('count' in v && 'percentage' in v) {
      const p = v.percentage > 1 ? v.percentage / 100 : v.percentage
      return `${v.count.toLocaleString()} · ${pct(p)}`
    }
    if ('value' in v) return formatByMagnitude(v.value, magType)
  }
  return formatByMagnitude(v, magType)
}

function DistributionChart({ data }) {
  const entries = Object.entries(data)
  const magType = magnitudeTypeOf(entries)
  const isBandLike = entries.some(([k]) => BAND_ORDER.includes(k.toUpperCase()))

  const items = entries.map(([k, v], i) => {
    const raw = magnitudeOf(v)
    return {
      key: k,
      name: k.toUpperCase(),
      label: humanize(k),
      value: magType === 'percent' ? raw * 100 : raw,
      display: formatDistValue(v, magType),
      color: BAND_COLORS[k.toUpperCase()] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }
  })

  if (isBandLike) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(90, items.length * 32)}>
        <BarChart data={items} layout="vertical" margin={{ left: 4, right: 24, top: 2, bottom: 2 }}>
          <CartesianGrid horizontal={false} stroke="#e1e6e2" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} {...AXIS_STYLE} width={56} />
          <Tooltip formatter={(_, __, p) => [p.payload.display, p.payload.label]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {items.map((it, i) => <Cell key={i} fill={it.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={104} height={104}>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="label" innerRadius={28} outerRadius={48} paddingAngle={2}>
            {items.map((it, i) => <Cell key={i} fill={it.color} />)}
          </Pie>
          <Tooltip formatter={(_, __, p) => [p.payload.display, p.payload.label]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 text-xs flex-1 min-w-0">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: it.color, flexShrink: 0 }} />
            <span className="text-gray-600 truncate">{it.label}</span>
            <span className="mono font-semibold ml-auto pl-2">{it.display}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompositeMetric({ obj }) {
  const entries = Object.entries(obj)
  const scalarEntries = entries.filter(([, v]) => v === null || v === undefined || typeof v !== 'object')
  const complexEntries = entries.filter(([, v]) => v && typeof v === 'object')

  return (
    <div className="w-full space-y-3">
      {scalarEntries.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {scalarEntries.map(([k, v]) => (
            <div key={k} style={{ minWidth: 84 }}>
              <div className="note text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 2 }}>
                {humanize(k)}
              </div>
              <div className="mono font-semibold" style={{ fontSize: '1.02em' }}>{formatScalar(k, v)}</div>
            </div>
          ))}
        </div>
      )}

      {complexEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {complexEntries.map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid #e1e6e2', borderRadius: 8, padding: 10 }}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{humanize(k)}</p>
              <MetricChartRenderer rawVal={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatScalar(key, val) {
  if (val === null || val === undefined || val === '') return 'N/A'
  if (typeof val !== 'number') return String(val)
  if (COUNT_KEY_RE.test(key)) return val.toLocaleString()
  if (PERCENT_KEY_RE.test(key)) return pct(val)
  if (CURRENCY_KEY_RE.test(key) || Math.abs(val) >= 1000) return money(val)
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function humanize(key) {
  return key
    .split('_')
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/* ---------------------------------------------------------------------- */
/* Metric catalog → category grouping                                     */
/* ---------------------------------------------------------------------- */

function formatMetricsForDisplay(rawMetrics) {
  const categoryMap = {
    application_volume: 'Application Volume',
    channel_mix: 'Channel Mix',
    product_mix: 'Product Mix',
    document_processing: 'Document Processing',
    data_quality: 'Data Quality',
    kyc_verification: 'KYC Verification',
    identity_verification: 'Identity Verification',
    sanctions_screening: 'Sanctions Screening',
    address_verification: 'Address Verification',
    contact_verification: 'Contact Verification',
    decision_volume: 'Decision Volume',
    decision_outcomes: 'Decision Outcomes',
    credit_quality: 'Credit Quality',
    fraud_detection: 'Fraud Detection',
    affordability: 'Affordability',
    limits_and_pricing: 'Limits & Pricing',
    policy_exceptions: 'Policy Exceptions',
    account_portfolio: 'Account Portfolio',
    payment_processing: 'Payment Processing',
    account_funding: 'Account Funding',
    delinquency_metrics: 'Delinquency Metrics',
    disbursement_velocity: 'Disbursement Velocity',
    ifrs_9_staging: 'IFRS 9 Staging',
    ecl_calculation: 'ECL Calculation',
    credit_risk_indicators: 'Credit Risk Indicators',
    early_warning: 'Early Warning',
    portfolio_performance: 'Portfolio Performance',
    recovery_effectiveness: 'Recovery Effectiveness',
    concentration_risk: 'Concentration Risk',
    vintage_analysis: 'Vintage Analysis',
    operational_metrics: 'Operational Metrics',
    collection_effectiveness: 'Collection Effectiveness',
    work_queue: 'Work Queue',
    strategy_effectiveness: 'Strategy Effectiveness',
    financial_outcomes: 'Financial Outcomes',
    recent_trends: 'Recent Trends',
    account_linkage: 'Account Linkage',
  }

  const formatted = {}

  function extractMetrics(obj, parentKey = '', category = 'Other') {
    for (const [key, val] of Object.entries(obj || {})) {
      if (!val || typeof val !== 'object') continue

      const fullKey = parentKey ? `${parentKey}_${key}` : key

      if ('value' in val) {
        const metricObj = val
        const unit = metricObj.unit || ''
        const description = metricObj.description || ''
        const trend = metricObj.trend || 'unknown'
        const rawVal = metricObj.value

        const label = fullKey
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())

        let formattedValue = ''
        if (typeof rawVal !== 'object') {
          if (rawVal === undefined || rawVal === null) {
            formattedValue = 'N/A'
          } else if (unit === 'percent' || unit === 'percentage') {
            const num = Number(rawVal)
            formattedValue = isNaN(num) ? String(rawVal) : pct(num > 1 ? num / 100 : num)
          } else if (unit === 'currency') {
            formattedValue = money(rawVal)
          } else {
            formattedValue = String(rawVal)
          }
        }

        const formattedMetric = {
          key: fullKey,
          label,
          rawVal,
          formattedValue,
          unit,
          description,
          trend,
        }

        if (!formatted[category]) formatted[category] = []
        formatted[category].push(formattedMetric)
      } else {
        extractMetrics(val, fullKey, category)
      }
    }
  }

  for (const [groupKey, groupVal] of Object.entries(rawMetrics || {})) {
    let category = 'Other'
    for (const [pattern, catName] of Object.entries(categoryMap)) {
      if (groupKey.includes(pattern)) {
        category = catName
        break
      }
    }
    extractMetrics({ [groupKey]: groupVal }, '', category)
  }

  const sorted = {}
  Object.keys(formatted)
    .sort()
    .forEach((key) => {
      sorted[key] = formatted[key]
    })

  return sorted
}