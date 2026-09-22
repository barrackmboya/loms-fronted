import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Empty } from '../components'
import { money, pct } from '../lib/format'

export default function PolicyPack() {
  const [policy, setPolicy] = useState(null)
  const [decisioningMetrics, setDecisioningMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  useEffect(() => {
    // Fetch both policy pack and decisioning metrics
    const loadData = async () => {
      try {
        setMetricsLoading(true)
        // Fetch policy pack
        const policyResult = await api.policy().then(setPolicy).catch(() => setPolicy(false))

        // Fetch decisioning metrics for policy exception rates
        const metricsResult = await api.decisioningMetrics()
        setDecisioningMetrics(metricsResult)
        setMetricsError(null)
      } catch (e) {
        setMetricsError(`Failed to load data: ${e.message}`)
        setPolicy(false)
        setDecisioningMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadData()
  }, [])

  if (policy === false) return <Empty>The policy pack endpoint is unreachable.</Empty>
  if (!policy) return <Empty>Loading the policy pack…</Empty>

  const { version, ...params } = policy
  return (
    <div className="grid cols-2">
      <div className="soft">
        <h2>Active policy pack</h2>
        <p className="note">Every threshold the engine uses is table-driven and versioned.
          Changing a cutoff is a promotion, not a code edit.</p>
        <p className="mono">{version}</p>
        <div className="inset mono">
          {Object.entries(params).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{k}</span>
              <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>What is not editable here yet</h2>
        <p className="note">Thresholds are read-only in this prototype. Editing them needs
          maker-checker, an approver identity and an audit trail before it can be a screen —
          otherwise the fastest way to change credit appetite is a text box, which is the
          failure mode the schema warns about.</p>
      </div>

      {metricsLoading && <p>Loading decisioning metrics...</p>}
      {metricsError && <p className="error">{metricsError}</p>}
      {decisioningMetrics && (
        <div className="panel">
          <h2>Decisioning Metrics (Policy Exceptions)</h2>
          <div className="metrics-panel">
            <div className="grid cols-2">
              <div>
                <strong>Conditional Decisions:</strong> {(decisioningMetrics.metrics?.policy_exceptions?.conditional_decision_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Referral Rate:</strong> {(decisioningMetrics.metrics?.policy_exceptions?.referral_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Auto-Approve Rate:</strong> {(decisioningMetrics.metrics?.fraud_detection?.auto_approve_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Average APR:</strong> {(decisioningMetrics.metrics?.credit_quality?.average_apr?.value || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
