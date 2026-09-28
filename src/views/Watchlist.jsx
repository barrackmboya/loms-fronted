import { useState, useEffect } from 'react'
import { Empty, Meter, Tag } from '../components'
import { bandTone, money } from '../lib/format'
import { api } from '../lib/api'

export default function Watchlist({ rows, userProfile }) {
  if (!rows) return <Empty>Loading the watchlist…</Empty>
  if (!rows.length) return <Empty>No amber or red accounts. Run a month to move the book.</Empty>

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  // Fetch monitoring/EWS metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)
        // Only fetch if user has access to monitoring module
        if (userProfile?.accessible_modules?.includes('monitoring') ?? false) {
          const result = await api.monitoringMetrics()
          setMetrics(result)
          setMetricsError(null)
        } else {
          setMetrics(null)
          setMetricsError('Access denied: You do not have permission to view monitoring metrics')
        }
      } catch (e) {
        setMetricsError(`Failed to load monitoring metrics: ${e.message}`)
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
        <h2>Early warning watchlist</h2>
        <p className="note">These are prevention cases, not collection cases. The contact SLA
          runs from the band change, not from the first missed instalment.</p>

        {metricsLoading && <p>Loading monitoring metrics...</p>}
        {metricsError && <p className="error">{metricsError}</p>}
        {metrics && (
          <div className="metrics-panel">
            <h3>Early Warning Metrics</h3>
            <div className="grid cols-2">
              <div>
                <strong>EWS Coverage:</strong> {(metrics.metrics?.operational_metrics?.ews_coverage_rate?.value || 0).toFixed(1)}% of book
              </div>
              <div>
                <strong>Avg EWS Score:</strong> {(metrics.metrics?.early_warning?.average_score?.value || 0).toFixed(1)}
              </div>
              <div>
                <strong>Red Band:</strong> {(metrics.metrics?.early_warning?.bands_distribution?.RED?.value || 0)} accounts
              </div>
              <div>
                <strong>Amber Band:</strong> {(metrics.metrics?.early_warning?.bands_distribution?.AMBER?.value || 0)} accounts
              </div>
            </div>
          </div>
        )}

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Account</th><th>Band</th><th style={{ width: 140 }}>Score</th>
                <th className="right">DPD</th><th className="right">Balance</th>
                <th>Drivers</th><th>Required action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id}>
                  <td className="mono">{r.account_id}</td>
                  <td><Tag tone={bandTone(r.band)}>{r.band}</Tag></td>
                  <td>
                    <Meter value={r.score} tone={r.band === 'RED' ? 'bad' : 'warn'} />
                    <span className="mono">{r.score}</span>
                  </td>
                  <td className="right mono">{r.dpd}</td>
                  <td className="right mono">{money(r.balance)}</td>
                  <td className="mono">{r.drivers.join(', ') || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}