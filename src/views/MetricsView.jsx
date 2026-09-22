import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money, pct } from '../lib/format'
import { Empty, Kpi } from '../components'
import { Code } from 'lucide-react'

export default function MetricsView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState('origination')

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

  useEffect(() => {
    if (!config) {
      setError(`Unknown module: ${selectedModule}`)
      setLoading(false)
      return
    }

    const loadMetrics = async () => {
      try {
        setLoading(true)
        const result = await config.fn()
        setData(result)
        setError(null)
      } catch (e) {
        setError(`Can't reach the API. Start Django on port 8000, then reload. (${e.message})`)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [selectedModule])

  if (loading) return <p>Loading {config?.name || 'module'} metrics…</p>
  if (error) return <p className="error">{error}</p>
  if (!data) return <Empty>No metrics data available</Empty>

  const moduleOptions = Object.entries(moduleConfig).map(([key, value]) => ({
    value: key,
    label: value.name,
  }))

  const formattedMetrics = formatMetricsForDisplay(data.metrics || {})

  return (
    <div className="panel">
      <div className="flex justify-between items-center mb-4">
        <h2>{config.name} Metrics</h2>
        <div className="select">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            {moduleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="note">Real-time metrics for the {config.name.toLowerCase()} module.</p>

      {/* Summary KPIs */}
      <div className="grid cols-4 mb-6">
        <Kpi label="Total Metrics" value={data.summary?.total_metrics ?? 0} />
        <Kpi label="Healthy" value={data.summary?.healthy_count ?? 0} note="metrics" />
        <Kpi label="Warnings" value={data.summary?.warning_count ?? 0} note="metrics" />
        <Kpi label="Critical" value={data.summary?.critical_count ?? 0} note="metrics" />
      </div>

      {/* Metrics details */}
      <div className="metrics-detail">
        {Object.entries(formattedMetrics).map(([category, metrics]) => (
          <div key={category} className="metric-category mb-6">
            <h3 className="mb-3 text-lg font-semibold">{category}</h3>
            {metrics.length > 0 ? (
              <div className="grid cols-2 gap-4">
                {metrics.map((metric) => (
                  <div key={metric.key} className="metric-card p-4 border rounded">
                    <h4 className="font-medium text-gray-800">{metric.label}</h4>
                    <div className="metric-value text-2xl font-bold my-1">
                      {metric.formattedValue}
                      {metric.unit && metric.unit !== 'distribution' && (
                        <span className="metric-unit text-sm font-normal text-gray-500 ml-1">
                          {metric.unit}
                        </span>
                      )}
                    </div>
                    {metric.description && (
                      <p className="metric-description text-sm text-gray-600">
                        {metric.description}
                      </p>
                    )}
                    {metric.trend && metric.trend !== 'unknown' && (
                      <span className={`metric-trend trend-${metric.trend}`}>
                        {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">No metrics in this category</p>
            )}
          </div>
        ))}
      </div>

      {/* Raw data toggle */}
      <div className="mt-4 pt-4 bt">
        <button
          className="btn ghost"
          onClick={() => alert(JSON.stringify(data, null, 2))}
        >
          <Code size={16} /> View raw data
        </button>
      </div>
    </div>
  )
}

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

  // Flattens leaf metric nodes
  function extractMetrics(obj, parentKey = '', category = 'Other') {
    for (const [key, val] of Object.entries(obj || {})) {
      if (!val || typeof val !== 'object') continue

      const fullKey = parentKey ? `${parentKey}_${key}` : key

      // Check if current node is a metric object
      if ('value' in val) {
        const metricObj = val
        const unit = metricObj.unit || ''
        const description = metricObj.description || ''
        const trend = metricObj.trend || 'unknown'
        const rawVal = metricObj.value

        let label = fullKey
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())

        let formattedValue = ''

        if (rawVal === undefined || rawVal === null) {
          formattedValue = 'N/A'
        } else if (unit === 'percent' || unit === 'percentage') {
          const num = Number(rawVal)
          formattedValue = isNaN(num) ? String(rawVal) : pct(num > 1 ? num / 100 : num)
        } else if (unit === 'currency') {
          formattedValue = money(rawVal)
        } else if (unit === 'distribution' && typeof rawVal === 'object' && rawVal !== null) {
          formattedValue = Object.entries(rawVal)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        } else if (typeof rawVal === 'number' && (unit === 'score' || unit === 'ratio')) {
          formattedValue = String(rawVal)
        } else {
          formattedValue = String(rawVal)
        }

        const formattedMetric = {
          key: fullKey,
          label,
          formattedValue,
          unit,
          description,
          trend,
        }

        if (!formatted[category]) formatted[category] = []
        formatted[category].push(formattedMetric)
      } else {
        // Recursive step for nested metric groups (e.g., application_volume.daily)
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

  // Sort categories alphabetically
  const sorted = {}
  Object.keys(formatted)
    .sort()
    .forEach((key) => {
      sorted[key] = formatted[key]
    })

  return sorted
}