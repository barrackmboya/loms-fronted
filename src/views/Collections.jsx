import { useState, useEffect } from 'react'
import { Empty, Tag } from '../components'
import { money } from '../lib/format'
import { api } from '../lib/api'

export default function Collections({ rows, userProfile }) {
  if (!rows) return <Empty>Loading the queue…</Empty>
  if (!rows.length) return <Empty>No open cases. Cases open at the policy DPD in the policy pack.</Empty>

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  // Fetch recovery/collections metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)
        // Only fetch if user has access to recovery module
        if (userProfile?.accessible_modules?.includes('recovery') ?? false) {
          const result = await api.recoveryMetrics()
          setMetrics(result)
          setMetricsError(null)
        } else {
          setMetrics(null)
          setMetricsError('Access denied: You do not have permission to view recovery metrics')
        }
      } catch (e) {
        setMetricsError(`Failed to load recovery metrics: ${e.message}`)
        setMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [userProfile, userProfile?.accessible_modules])

  return (
    <div className="grid">
      <div className="panel">
        <h2>Collections queue</h2>
        <p className="note">Ranked by expected cash from today&apos;s action minus the cost of
          that action. A DPD 45 with a high pay-today score outranks a silent DPD 20.</p>

        {metricsLoading && <p>Loading recovery metrics...</p>}
        {metricsError && <p className="error">{metricsError}</p>}
        {metrics && (
          <div className="metrics-panel">
            <h3>Recovery & Collections Metrics</h3>
            <div className="grid cols-2">
              <div>
                <strong>Cure Rate:</strong> {(metrics.metrics?.collection_effectiveness?.cure_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Recovery Rate:</strong> {(metrics.metrics?.collection_effectiveness?.recovery_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Write-off Rate:</strong> {(metrics.metrics?.financial_outcomes?.write_off_rate?.value || 0).toFixed(1)}%
              </div>
              <div>
                <strong>Right-Party Contact:</strong> {(metrics.metrics?.collection_effectiveness?.right_party_contact_rate?.value || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Case</th><th>Account</th><th className="right">DPD</th>
                <th className="right">Balance</th><th className="right">Pay today</th>
                <th className="right">Cure in 30d</th><th className="right">Roll</th>
                <th className="right">Expected recovery</th><th>Strategy</th>
                <th className="right">Work priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.case_id}>
                  <td className="mono">{r.case_id}</td>
                  <td className="mono">{r.account_id}</td>
                  <td className="right mono">{r.dpd}</td>
                  <td className="right mono">{money(r.balance)}</td>
                  <td className="right mono">{r.p_pay_today}</td>
                  <td className="right mono">{r.p_cure_30}</td>
                  <td className="right mono">{r.p_roll}</td>
                  <td className="right mono">{money(r.expected_recovery)}</td>
                  <td><Tag tone="info">{r.strategy.replace(/_/g, ' ').toLowerCase()}</Tag></td>
                  <td className="right mono">{money(r.work_priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}