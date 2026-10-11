import { useState, useEffect } from 'react'
import { Empty, Tag, Loader } from '../components'
import { money, pct, stageTone } from '../lib/format'
import { api } from '../lib/api'

export default function Accounts({ rows, userProfile }) {
  if (!rows) return <Empty>Loading accounts…</Empty>
  if (!rows.length) return <Empty>Nothing booked yet. Seed a book or approve a file in Originate.</Empty>

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  // Fetch parties/KYC metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)
        // Only fetch parties metrics if user has access to the parties module
        const result = (userProfile?.accessible_modules?.includes('parties') ?? false)
          ? await api.partiesMetrics()
          : null
        setMetrics(result)
        setMetricsError(null)
      } catch (e) {
        setMetricsError(`Failed to load KYC metrics: ${e.message}`)
        setMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [userProfile, userProfile?.accessible_modules])

  return (
    <div className="panel">
      <h2>Booked accounts and IFRS 9 staging</h2>
      <p className="note">Stage and ECL come from the last provisioning run, not from days
        past due alone — a relative PD move can stage an account that is still current.</p>

      {metricsLoading && <Loader label="Loading KYC metrics..." />}
      {metricsError && <p className="error">{metricsError}</p>}
      {metrics && (
        <div className="metrics-panel">
          <h3>KYC & Identity Metrics</h3>
          <div className="grid cols-2">
            <div>
              <strong>Verified:</strong> {(metrics.metrics?.kyc_verification?.distribution?.VERIFIED?.percentage || 0)}%
            </div>
            <div>
              <strong>Pending:</strong> {(metrics.metrics?.kyc_verification?.distribution?.PENDING?.percentage || 0)}%
            </div>
            <div>
              <strong>Failed:</strong> {(metrics.metrics?.kyc_verification?.distribution?.FAILED?.percentage || 0)}%
            </div>
            <div>
              <strong>Avg Face Match:</strong> {(metrics.metrics?.identity_verification?.average_face_match?.value || 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Borrower</th><th>Grade</th>
              <th className="right">MOB</th><th className="right">DPD</th>
              <th className="right">Balance</th><th className="right">EIR</th>
              <th>Status</th><th>Stage</th><th className="right">ECL</th><th>SICR triggers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.id}</td>
                <td>{a.party}</td>
                <td className="mono">{a.grade}</td>
                <td className="right mono">{a.mob}</td>
                <td className="right mono">{a.dpd}</td>
                <td className="right mono">{money(a.balance)}</td>
                <td className="right mono">{pct(a.eir, 2)}</td>
                <td className="mono">{a.status.toLowerCase()}</td>
                <td><Tag tone={stageTone(a.stage)}>{a.stage}</Tag></td>
                <td className="right mono">{money(a.ecl)}</td>
                <td className="mono">{a.sicr_triggers.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}