import { useState, useEffect } from 'react'
import { CheckCircle2, Fingerprint, ShieldAlert, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { decisionTone, money, pct } from '../lib/format'
import { Empty, Meter, Rows, Tag } from '../components'

const BLANK = {
  name: 'Achieng Omondi', amount_requested: 250000, tenure_months: 24,
  stated_income: 95000, verified_income: 95000, existing_debt_service: 9000,
  bureau_score: 690, bureau_enquiries_6m: 2, delinquencies_12m: 0, bounces_6m: 0,
  doc_source: 'AA', device_apps_24h: 1, tamper_score: 0.08, salary_domiciled: true,
}

const FIELDS = [
  ['amount_requested', 'Amount requested'], ['tenure_months', 'Tenure (months)'],
  ['verified_income', 'Verified monthly income'], ['existing_debt_service', 'Existing debt service'],
  ['bureau_score', 'Bureau score'], ['bureau_enquiries_6m', 'Enquiries, last 6 months'],
  ['delinquencies_12m', 'Delinquencies, last 12 months'], ['bounces_6m', 'Bounced debits, last 6 months'],
  ['device_apps_24h', 'Applications from this device, 24h'], ['tamper_score', 'Worst document tamper score'],
]

export default function Originate({ onBooked }) {
  const [form, setForm] = useState(BLANK)
  const [result, setResult] = useState(null)
  const [appId, setAppId] = useState(null)
  const [booked, setBooked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Fetch origination metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)
        const result = await api.originationMetrics()
        setMetrics(result)
        setMetricsError(null)
      } catch (e) {
        setMetricsError(`Failed to load metrics: ${e.message}`)
        setMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadMetrics()
  }, [])

  const decide = async () => {
    setBusy(true); setBooked(null); setError(null)
    try {
      const app = await api.createApplication(form)
      setAppId(app.application_id)
      setResult(await api.decide(app.application_id))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const book = async () => {
    setBusy(true)
    try { setBooked(await api.book(appId)); onBooked?.() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="grid cols-2">
      <div className="panel">
        <h2>New application</h2>
        <p className="note">Stated and verified income stay separate — the scorecard and
          affordability engine only read the verified figure.</p>

        <label htmlFor="name">Applicant</label>
        <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />

        {metricsLoading && <p>Loading origination metrics...</p>}
        {metricsError && <p className="error">{metricsError}</p>}
        {metrics && (
          <div className="metrics-panel">
            <h3>Origination Metrics</h3>
            <div className="grid cols-2">
              <div>
                <strong>Today:</strong> {metrics.metrics?.application_volume?.daily?.value || 0} applications
              </div>
              <div>
                <strong>Approval Rate:</strong> {(metrics.metrics?.decision_outcomes?.distribution?.APPROVE?.percentage || 0)}%
              </div>
              <div>
                <strong>Auto-Approve:</strong> {(metrics.metrics?.fraud_detection?.auto_approve_rate?.value || 0)}%
              </div>
              <div>
                <strong>Avg DSR:</strong> {(metrics.metrics?.affordability?.average_dsr?.value || 0).toFixed(3)}
              </div>
            </div>
          </div>
        )}

        <div className="grid cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key}>{label}</label>
              <input id={key} type="number" step="any" value={form[key]}
                onChange={(e) => set(key, Number(e.target.value))} />
            </div>
          ))}
          <div>
            <label htmlFor="doc_source">Income verification source</label>
            <select id="doc_source" value={form.doc_source} onChange={(e) => set('doc_source', e.target.value)}>
              <option value="AA">Account aggregator</option>
              <option value="EMPLOYER">Employer API</option>
              <option value="UPLOAD">Customer upload</option>
            </select>
          </div>
          <div>
            <label htmlFor="salary_domiciled">Salary domiciled with us</label>
            <select id="salary_domiciled" value={String(form.salary_domiciled)}
              onChange={(e) => set('salary_domiciled', e.target.value === 'true')}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
        </div>

        <p style={{ marginTop: 18 }}>
          <button className="btn" disabled={busy} onClick={decide}>
            <Fingerprint size={16} /> {busy ? 'Deciding…' : 'Run decision'}
          </button>
        </p>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="grid">
        {result
          ? <DecisionRecord res={result} onBook={book} booked={booked} busy={busy} />
          : <div className="soft">
              <h2>Decision record</h2>
              <Empty>Submit a file to see gates G1–G9, the scorecard reason codes, which
                constraint bound the limit, the priced offer, and how collectable this
                borrower would be if the loan ever went bad.</Empty>
            </div>}
      </div>
    </div>
  )
}

function DecisionRecord({ res, onBook, booked, busy }) {
  const gates = Object.entries(res.gates || {})
  const declined = res.decision === 'DECLINE'

  return (
    <>
      <div className="panel">
        <h2>Decision</h2>
        <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px' }}>
          <Tag tone={decisionTone(res.decision)}>{res.decision}</Tag>
          <span className="mono">grade {res.grade} · 12-month PD {pct(res.pd_12m, 2)}</span>
        </p>

        <p className="eyebrow">Gates</p>
        {gates.map(([key, gate]) => (
          <div className="gate" key={key}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {gate.pass
                ? <CheckCircle2 size={15} color="var(--ok)" />
                : <XCircle size={15} color="var(--bad)" />}
              {key.replace(/_/g, ' ').toLowerCase()}
            </span>
            <span className="why">{gate.pass ? '' : gate.fail_path}</span>
          </div>
        ))}

        <p className="eyebrow">Reason codes</p>
        <p className="mono">{(res.reason_codes || []).join(' · ') || 'none'}</p>

        <p style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy || declined || booked} onClick={onBook}>
            {booked ? 'Booked' : declined ? 'Cannot book a declined file' : 'Book and post day-1 ECL'}
          </button>
        </p>
        {booked && (
          <p className="mono" style={{ marginTop: 10 }}>
            Account {booked.account_id} · stage {booked.day1_ecl.stage} ·
            ECL {money(booked.day1_ecl.ecl)} on EAD {money(booked.day1_ecl.ead)}
          </p>
        )}
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h2>Limit and price</h2>
          <Rows rows={[
            ['Approved limit', money(res.limit_detail.approved_limit)],
            ['Binding constraint', res.limit_detail.binding.join(', ')],
            ['Debt service ratio', pct(res.affordability.dsr)],
            ['Expected loss in price', pct(res.pricing.el_pct, 2)],
            ['All-in rate', pct(res.pricing.all_in_rate, 2)],
            ['Monthly instalment', money(res.pricing.monthly_instalment)],
          ]} />
        </div>

        <div className="soft">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldAlert size={16} /> Fraud fusion
          </h2>
          <p className="mono">{res.fraud.composite} / 1000 · {res.fraud.decision}</p>
          <Meter value={res.fraud.composite / 1000}
            tone={res.fraud.composite > 640 ? 'bad' : res.fraud.composite > 420 ? 'warn' : ''} />

          <p className="eyebrow">Signals above warn</p>
          <div className="inset mono">
            {res.fraud.signals.length
              ? res.fraud.signals.map(([code, value]) => (
                  <div key={code}>{code}: {String(value)}</div>))
              : 'none'}
          </div>

          <p className="eyebrow">If this file ever reaches collections</p>
          <div className="inset mono">
            right-party contact {pct(res.collection_propensity.p_right_party_contact)}<br />
            recovery if default {pct(res.collection_propensity.expected_recovery_rate_if_default)}<br />
            mandate {res.collection_propensity.recommended_mandate_type}
          </div>

          <p className="eyebrow">Model provenance</p>
          <p className="mono" style={{ color: 'var(--muted)' }}>
            {Object.values(res.model_versions).join(' · ')}
          </p>
        </div>
      </div>
    </>
  )
}
