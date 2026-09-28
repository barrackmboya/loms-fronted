import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Empty } from '../components'
import { money, pct } from '../lib/format'

export default function PolicyPack({ userProfile }) {
  const [policy, setPolicy] = useState(null)
  const [decisioningMetrics, setDecisioningMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  useEffect(() => {
    // Fetch both policy pack and decisioning metrics
    const loadData = async () => {
      try {
        setMetricsLoading(true)

        // Fetch policy pack only if user has access to policy module
        let policyResult = null
        if (userProfile?.accessible_modules?.includes('policy') ?? false) {
          policyResult = await api.policy()
          setPolicy(policyResult)
        } else {
          setPolicy(false) // Indicate access denied
          setMetricsError('Access denied: You do not have permission to view policy pack')
        }

        // Fetch decisioning metrics for policy exception rates only if user has access to decisioning module
        let metricsResult = null
        if (userProfile?.accessible_modules?.includes('decisioning') ?? false) {
          metricsResult = await api.decisioningMetrics()
          setDecisioningMetrics(metricsResult)
        } else {
          setDecisioningMetrics(null)
          // Only set error if we haven't already set an access denied error for policy
          if (!metricsError) {
            setMetricsError('Access denied: You do not have permission to view decisioning metrics')
          }
        }

        // Clear error if both fetches succeeded or were skipped due to lack of access
        if ((userProfile?.accessible_modules?.includes('policy') ?? false) ||
            (userProfile?.accessible_modules?.includes('decisioning') ?? false)) {
          // If they have access to at least one, clear previous errors unless it was an actual fetch error
          // We'll rely on the individual error setting above
        }
      } catch (e) {
        setMetricsError(`Failed to load data: ${e.message}`)
        setPolicy(false)
        setDecisioningMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadData()
  }, [userProfile, userProfile?.accessible_modules])

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