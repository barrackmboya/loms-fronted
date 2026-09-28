import { useState, useEffect } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { Empty, Kpi, Meter } from '../components'
import { money, pct } from '../lib/format'
import { api } from '../lib/api'

const AXIS = { stroke: '#5d6b66', fontSize: 12 }

const STAGE_COLOR = {
  stage1: '#176b63',
  stage2: '#c08a1e',
  stage3: '#9e2b2b',
  stage_1: '#176b63',
  stage_2: '#c08a1e',
  stage_3: '#9e2b2b',
}

export default function Portfolio({ data, userProfile }) {
  const [monitoringMetrics, setMonitoringMetrics] = useState(null)
  const [provisioningMetrics, setProvisioningMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  // Fetch monitoring and provisioning metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)

        // Only fetch metrics if user has access to the respective modules
        const [monitoringResult, provisioningResult] = await Promise.all([
          (userProfile?.accessible_modules?.includes('monitoring') ?? false)
            ? api.monitoringMetrics()
            : Promise.resolve(null),
          (userProfile?.accessible_modules?.includes('provisioning') ?? false)
            ? api.provisioningMetrics()
            : Promise.resolve(null),
        ])

        setMonitoringMetrics(monitoringResult)
        setProvisioningMetrics(provisioningResult)
        setMetricsError(null)
      } catch (e) {
        setMetricsError(`Failed to load metrics: ${e.message}`)
        setMonitoringMetrics(null)
        setProvisioningMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [userProfile, userProfile?.accessible_modules])

  if (!data) return <Empty>Loading the book…</Empty>
  if (!data.accounts) {
    return <Empty>No accounts yet. Seed a book, then run a month or two.</Empty>
  }

  const stages = Object.entries(data.stage_mix).map(([stage, exposure]) => ({
    stage,
    exposure,
    coverage: data.coverage_by_stage?.[stage] || 0,
  }))

  const vintage = (data.vintage_dq || []).map((v) => ({
    ...v,
    dq: v.dq30_pct * 100,
  }))

  // The API returns stage_1/stage_2/stage_3.
  const stageDistribution =
    provisioningMetrics?.metrics?.ifrs9_staging?.stage_distribution?.value || {}

  const eclCalculation =
    provisioningMetrics?.metrics?.ecl_calculation || {}

  const hasPortfolioMetrics =
    Boolean(monitoringMetrics || provisioningMetrics)

  return (
    <div className="grid">
      <div className="grid cols-4">
        <Kpi
          label="Gross book"
          value={money(data.book)}
          note={`${data.accounts} accounts`}
        />

        <Kpi
          label="PAR30"
          value={pct(data.par30)}
          note={`PAR90 ${pct(data.par90)}`}
        />

        <Kpi
          label="ECL stock"
          value={money(data.ecl_stock)}
          note={`coverage ${pct(data.ecl, 2)}`}
        />

        <Kpi
          label="Approval rate"
          value={pct(data.approval_rate)}
          note="of decisioned files"
        />
      </div>

      {metricsLoading && <p>Loading portfolio metrics...</p>}

      {metricsError && (
        <p className="error">{metricsError}</p>
      )}

      {hasPortfolioMetrics && (
        <div className="panel">
          <h2>Portfolio Health Metrics</h2>

          <div className="grid cols-4">
            {monitoringMetrics && (
              <>
                <div>
                  <strong>EWS Green:</strong>{' '}
                  {monitoringMetrics.metrics?.early_warning
                    ?.bands_distribution?.GREEN?.value || 0}{' '}
                  accounts
                </div>

                <div>
                  <strong>EWS Amber:</strong>{' '}
                  {monitoringMetrics.metrics?.early_warning
                    ?.bands_distribution?.AMBER?.value || 0}{' '}
                  accounts
                </div>

                <div>
                  <strong>EWS Red:</strong>{' '}
                  {monitoringMetrics.metrics?.early_warning
                    ?.bands_distribution?.RED?.value || 0}{' '}
                  accounts
                </div>
              </>
            )}

            {provisioningMetrics && (
              <>
                <div>
                  <strong>Stage 1:</strong>{' '}
                  {stageDistribution.stage_1?.percentage || 0}%
                </div>

                <div>
                  <strong>Stage 2:</strong>{' '}
                  {stageDistribution.stage_2?.percentage || 0}%
                </div>

                <div>
                  <strong>Stage 3:</strong>{' '}
                  {stageDistribution.stage_3?.percentage || 0}%
                </div>

                <div>
                  <strong>ECL Coverage:</strong>{' '}
                  {Number(eclCalculation.ecl_coverage_ratio?.value || 0).toFixed(2)}%
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid cols-2">
        <div className="panel">
          <h2>IFRS 9 stage mix</h2>

          <p className="note">
            Exposure by stage, with the coverage ratio each stage carries.
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stages}>
              <CartesianGrid
                vertical={false}
                stroke="#e1e6e2"
              />

              <XAxis
                dataKey="stage"
                {...AXIS}
              />

              <YAxis
                {...AXIS}
                tickFormatter={money}
                width={70}
              />

              <Tooltip
                formatter={(v) => money(v)}
              />

              <Bar dataKey="exposure">
                {stages.map((s) => (
                  <Cell
                    key={s.stage}
                    fill={STAGE_COLOR[s.stage] || '#176b63'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th className="right">Exposure</th>
                <th className="right">Coverage</th>
              </tr>
            </thead>

            <tbody>
              {stages.map((s) => (
                <tr key={s.stage}>
                  <td>
                    {s.stage.replace('stage', 'Stage ')}
                  </td>

                  <td className="right mono">
                    {money(s.exposure)}
                  </td>

                  <td className="right mono">
                    {pct(s.coverage, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Vintage delinquency by months on book</h2>

          <p className="note">
            A blended PAR hides a bad new vintage under an old good book.
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={vintage}>
              <CartesianGrid
                vertical={false}
                stroke="#e1e6e2"
              />

              <XAxis
                dataKey="mob"
                {...AXIS}
                label={{
                  value: 'MOB',
                  position: 'insideBottom',
                  offset: -3,
                  fill: '#5d6b66',
                  fontSize: 12,
                }}
              />

              <YAxis
                {...AXIS}
                unit="%"
                width={45}
              />

              <Tooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
              />

              <Line
                type="monotone"
                dataKey="dq"
                stroke="#b07d2b"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="30+ DPD"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h2>Concentration by risk grade</h2>

          <table>
            <tbody>
              {Object.entries(data.grade_concentration || {}).map(
                ([grade, share]) => (
                  <tr key={grade}>
                    <td
                      className="mono"
                      style={{ width: 40 }}
                    >
                      {grade}
                    </td>

                    <td>
                      <Meter value={share} />
                    </td>

                    <td
                      className="right mono"
                      style={{ width: 70 }}
                    >
                      {pct(share)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="soft">
          <h2>Early warning coverage</h2>

          <p className="note">
            Bands on the performing book, refreshed each servicing cycle.
          </p>

          <div className="inset">
            <table>
              <tbody>
                {['GREEN', 'AMBER', 'RED'].map((band) => (
                  <tr key={band}>
                    <td className="mono">
                      {band.toLowerCase()}
                    </td>

                    <td className="right mono">
                      {data.ews_bands?.[band] || 0} accounts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}