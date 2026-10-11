import { useState, useEffect } from 'react'
import { Empty, Tag, Loader } from '../components'
import { bandTone, money } from '../lib/format'
import { api } from '../lib/api'

/* ---------- Score gauge ---------- */

// EWS score runs 0..1 and higher = riskier, so green sits on the left and red on the right.
// Adjust the `to` thresholds so they match your backend band cut-offs.
const GAUGE_BANDS = [
  { from: 0,    to: 0.25, color: '#3f9b1f' }, // low risk
  { from: 0.25, to: 0.4,  color: '#9adf1e' },
  { from: 0.4,  to: 0.6,  color: '#ffd400' }, // amber
  { from: 0.6,  to: 1,    color: '#ff6a00' }, // red
]

const CX = 60, CY = 60, R_OUT = 52, R_IN = 36

const polar = (r, v) => {
  const a = ((180 - v * 180) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

const bandPath = (v0, v1) => {
  const [x0, y0] = polar(R_OUT, v0)
  const [x1, y1] = polar(R_OUT, v1)
  const [x2, y2] = polar(R_IN, v1)
  const [x3, y3] = polar(R_IN, v0)
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`
}

function ScoreGauge({ value, width = 130 }) {
  const v = Math.min(1, Math.max(0, Number(value) || 0))
  const digits = String(Math.round(v * 1000)).padStart(4, '0').split('') // 0.784 -> "0784"
  const rotation = 180 + v * 180 // 180deg = far left, 360deg = far right

  return (
    <div className="score-gauge" style={{ width }} role="img" aria-label={`EWS score ${v.toFixed(3)}`}>
      <svg viewBox="0 0 120 68" width="100%">
        {/* dial face */}
        <path d={`M4 60 A56 56 0 0 1 116 60 Z`} fill="#e9e9e9" />
        {GAUGE_BANDS.map((b) => (
          <path key={b.from} d={bandPath(b.from, b.to)} fill={b.color} />
        ))}
        {/* needle */}
        <g transform={`rotate(${rotation} ${CX} ${CY})`}>
          <polygon points={`${CX + 50},${CY} ${CX + 40},${CY - 2.5} ${CX},${CY - 5} ${CX},${CY + 5} ${CX + 40},${CY + 2.5}`} fill="#dcdcdc" stroke="#9a9a9a" strokeWidth="0.6" />
          <polygon points={`${CX + 50},${CY} ${CX + 40},${CY - 2.5} ${CX + 40},${CY + 2.5}`} fill="#d62020" />
        </g>
        <circle cx={CX} cy={CY} r="7" fill="#5a5a5a" stroke="#cfcfcf" strokeWidth="2" />
        <circle cx={CX} cy={CY} r="1.8" fill="#e9e9e9" />
      </svg>
      {/* odometer-style readout */}
      <div className="gauge-digits">
        {digits.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </div>
  )
}

const gaugeStyles = `
.score-gauge { display: inline-block; text-align: center; }
.gauge-digits { display: inline-flex; gap: 1px; margin-top: 2px; padding: 2px; border-radius: 4px; background: #d9dcd9; }
.gauge-digits span {
  min-width: 14px; padding: 1px 2px; border-radius: 2px;
  font: 700 13px/1.2 ui-monospace, Menlo, monospace; color: #3f9b1f;
  background: linear-gradient(#f4f6f4, #cfd3cf);
}
`

/* ---------- Watchlist ---------- */

export default function Watchlist({ rows, userProfile }) {
  // Hooks must run on every render, so they come before any early return.
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
  }, [userProfile])

  if (!rows) return <Empty>Loading the watchlist…</Empty>
  if (!rows.length) return <Empty>No amber or red accounts. Run a month to move the book.</Empty>

  return (
    <div className="grid">
      <style>{gaugeStyles}</style>
      <div className="panel">
        <h2>Early warning watchlist</h2>
        <p className="note">These are prevention cases, not collection cases. The contact SLA
          runs from the band change, not from the first missed instalment.</p>

        {metricsLoading && <Loader label="Loading monitoring metrics..." />}
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
                <th>Account</th><th>Band</th><th style={{ width: 150 }}>EWS score</th>
                <th className="right">DPD</th><th className="right">Balance</th>
                <th>Drivers</th><th>Required action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id}>
                  <td className="mono">{r.account_id}</td>
                  <td><Tag tone={bandTone(r.band)}>{r.band}</Tag></td>
                  <td><ScoreGauge value={r.score} /></td>
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