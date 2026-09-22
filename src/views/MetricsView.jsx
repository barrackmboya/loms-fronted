import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { money, pct } from '../lib/format'
import { Empty, Kpi, Meter, Rows, Tag } from '../components'
import { Code } from 'lucide-react'

export default function MetricsView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState('origination')

  // Map module names to their API functions and display names
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
  if (!config) {
    setError(`Unknown module: ${selectedModule}`)
    setLoading(false)
    return null
  }

  useEffect(() => {
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
  }, [selectedModule, config.fn])

  if (loading) return <p>Loading {config.name} metrics…</p>
  if (error) return <p className="error">{error}</p>
  if (!data) return <Empty>No metrics data available</Empty>

  // Module selector
  const moduleOptions = Object.entries(moduleConfig).map(([key, value]) => ({
    value: key,
    label: value.name
  }))

  // Format the metrics for display
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
      <div className="grid cols-4">
        <Kpi label="Total Metrics" value={data.summary?.total_metrics || 0} />
        <Kpi label="Healthy" value={data.summary?.healthy_count || 0} note="metrics" />
        <Kpi label="Warnings" value={data.summary?.warning_count || 0} note="metrics" />
        <Kpi label="Critical" value={data.summary?.critical_count || 0} note="metrics" />
      </div>

      {/* Metrics details */}
      <div className="metrics-detail">
        {Object.entries(formattedMetrics).map(([category, metrics]) => (
          <div key={category} className="metric-category">
            <h3>{category}</h3>
            {metrics.length > 0 ? (
              <div className="grid cols-2">
                {metrics.map((metric) => (
                  <div key={metric.name} className="metric-card">
                    <h4>{metric.label}</h4>
                    <div className="metric-value">
                      {metric.formattedValue}
                      {metric.unit && <span className="metric-unit">{metric.unit}</span>}
                    </div>
                    <p className="metric-description">{metric.description}</p>
                    {metric.trend && (
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

      {/* Raw data toggle (for debugging) */}
      <div className="mt-4 pt-4 bt">
        <button className="btn ghost" onClick={() =>
          alert(JSON.stringify(data, null, 2))
        }>
          <Code size={16} /> View raw data
        </button>
      </div>
    </div>
  )
}

// Helper function to format metrics for display
function formatMetricsForDisplay(metrics) {
  const formatted = {}

  // Group metrics by logical categories based on common prefixes or known groupings
  const categoryMap = {
    'application_volume': 'Application Volume',
    'channel_mix': 'Channel Mix',
    'product_mix': 'Product Mix',
    'document_processing': 'Document Processing',
    'data_quality': 'Data Quality',
    'kyc_verification': 'KYC Verification',
    'identity_verification': 'Identity Verification',
    'sanctions_screening': 'Sanctions Screening',
    'address_verification': 'Address Verification',
    'contact_verification': 'Contact Verification',
    'decision_volume': 'Decision Volume',
    'decision_outcomes': 'Decision Outcomes',
    'credit_quality': 'Credit Quality',
    'fraud_detection': 'Fraud Detection',
    'affordability': 'Affordability',
    'limits_and_pricing': 'Limits & Pricing',
    'policy_exceptions': 'Policy Exceptions',
    'account_portfolio': 'Account Portfolio',
    'payment_processing': 'Payment Processing',
    'account_funding': 'Account Funding',
    'delinquency_metrics': 'Delinquency Metrics',
    'disbursement_velocity': 'Disbursement Velocity',
    'ifrs_9_staging': 'IFRS 9 Staging',
    'ecl_calculation': 'ECL Calculation',
    'credit_risk_indicators': 'Credit Risk Indicators',
    'early_warning': 'Early Warning',
    'portfolio_performance': 'Portfolio Performance',
    'recovery_effectiveness': 'Recovery Effectiveness',
    'concentration_risk': 'Concentration Risk',
    'vintage_analysis': 'Vintage Analysis',
    'operational_metrics': 'Operational Metrics',
    'collection_effectiveness': 'Collection Effectiveness',
    'work_queue': 'Work Queue',
    'strategy_effectiveness': 'Strategy Effectiveness',
    'financial_outcomes': 'Financial Outcomes',
    'recent_trends': 'Recent Trends',
    'account_linkage': 'Account Linkage'
  }

  // Process each metric
  for (const [key, metricObj] of Object.entries(metrics)) {
    if (!metricObj || typeof metricObj !== 'object') continue

    const value = metricObj.value
    const unit = metricObj.unit || ''
    const description = metricObj.description || ''
    const trend = metricObj.trend || 'unknown'

    // Determine category
    let category = 'Other'
    for (const [pattern, catName] of Object.entries(categoryMap)) {
      if (key.includes(pattern)) {
        category = catName
        break
      }
    }

    // Format the value based on unit
    let formattedValue = value
    if (unit === 'percent' || unit === 'percentage') {
      formattedValue = pct(value / 100) // Convert from percentage to decimal for pct function
    } else if (unit === 'currency') {
      formattedValue = money(value)
    } else if (unit === 'days' || unit === 'count') {
      formattedValue = String(value)
    } else if (unit === 'ratio') {
      formattedValue = String(value.toFixed(3))
    } else if (unit === 'probability') {
      formattedValue = String(value.toFixed(4))
    } else if (unit === 'distribution') {
      // Handle distribution objects (like status distributions)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        formattedValue = Object.entries(value).map(([k, v]) =>
          `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`
        ).join(', ')
      } else {
        formattedValue = String(value)
      }
    } else {
      formattedValue = String(value)
    }

    const formattedMetric = {
      name: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      formattedValue,
      unit,
      description,
      trend
    }

    if (!formatted[category]) formatted[category] = []
    formatted[category].push(formattedMetric)
  }

  // Sort categories alphabetically for consistent display
  const sorted = {}
  Object.keys(formatted).sort().forEach(key => {
    sorted[key] = formatted[key]
  })

  return sorted
}