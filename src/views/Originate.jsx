import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Fingerprint, ShieldAlert, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { decisionTone, money, pct } from '../lib/format'
import { Empty, Meter, Rows, Tag } from '../components'

// Mirrors ApplicationCreateSerializer (apps/origination/serializers.py): every
// underwriting input the backend reads is represented here — including KYC
// evidence, stated vs verified income, and product/collateral. KYC evidence has
// no defaults (Phase 4): a NEW applicant states the facts (form opens
// conservative); a RETURNING applicant is picked by party_id and the backend
// reuses their stored KYC evidence.
const BLANK = {
  name: '',
  product: 'UNSECURED', collateral_value: 0,
  amount_requested: 250000, tenure_months: 24,
  stated_income: 95000, verified_income: 95000, existing_debt_service: 9000,
  bureau_score: 690, bureau_enquiries_6m: 2, delinquencies_12m: 0, bounces_6m: 0,
  doc_source: 'UPLOAD', device_apps_24h: 1, tamper_score: 0.08, salary_domiciled: false,
  ip_geo_mismatch: false,
  kyc_status: 'PENDING', face_match: 0, liveness: 0, sanctions_hit: true,
  phone_verified: false, address_tenure_months: 0,
  party_id: null,
}

const KYC_FIELDS = [
  ['face_match', 'Face match (0–1)'], ['liveness', 'Liveness (0–1)'],
  ['address_tenure_months', 'Address tenure (months)'],
]
const INCOME_FIELDS = [
  ['stated_income', 'Stated monthly income'], ['verified_income', 'Verified monthly income'],
  ['existing_debt_service', 'Existing debt service'], ['amount_requested', 'Amount requested'],
  ['tenure_months', 'Tenure (months)'],
]
const BUREAU_FIELDS = [
  ['bureau_score', 'Bureau score'], ['bureau_enquiries_6m', 'Enquiries, last 6 months'],
  ['delinquencies_12m', 'Delinquencies, last 12 months'], ['bounces_6m', 'Bounced debits, last 6 months'],
  ['device_apps_24h', 'Applications from this device, 24h'], ['tamper_score', 'Worst document tamper score'],
  ['collateral_value', 'Collateral value'],
]

const btsTone = (tier) => (
  { Platinum: 'ok', Gold: 'ok', Silver: 'info', Bronze: 'warn', 'Below Bronze': 'bad' }[tier] || 'info'
)
const prettify = (s) => s.replace(/_/g, ' ').toLowerCase()

export default function Originate({ onBooked, userProfile }) {
  const [form, setForm] = useState(BLANK)
  const [result, setResult] = useState(null)
  const [appId, setAppId] = useState(null)
  const [booked, setBooked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)
  // applicant source: pick an existing customer or state a new one's evidence
  const [existing, setExisting] = useState(false)
  const [parties, setParties] = useState([])
  const [partySearch, setPartySearch] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const hasAccess = userProfile?.accessible_modules?.includes('origination') ?? false

  const loadParties = useCallback(async (search) => {
    try {
      setParties(await api.parties(search))
    } catch { setParties([]) }  // picker stays empty; a new applicant can still be stated
  }, [])

  useEffect(() => {
    if (existing) loadParties(partySearch)
  }, [existing, partySearch, loadParties])

  // Origination-module metrics (GET /api/origination/metrics): application volume,
  // document processing and data quality. Reloaded after each decision or booking.
  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true)
      if (!hasAccess) {
        setMetrics(null)
        setMetricsError('Access denied: You do not have permission to view origination metrics')
        return
      }
      setMetrics(await api.originationMetrics())
      setMetricsError(null)
    } catch (e) {
      setMetricsError(`Failed to load metrics: ${e.message}`)
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }, [hasAccess])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  const decide = async () => {
    if (!hasAccess) {
      setError('Access denied: You do not have permission to perform origination actions')
      return
    }
    setBusy(true); setBooked(null); setError(null)
    try {
      if (existing && !form.party_id) {
        setError('Select a customer before running the decision.')
        return
      }
      // The backend takes either party_id (KYC evidence reused) or the full KYC
      // statement — never both. party_id is destructured out so a new-applicant
      // submit never posts the blank form's null (the backend would refuse it).
      const { kyc_status, face_match, liveness, sanctions_hit, phone_verified,
              address_tenure_months, name, party_id, ...rest } = form
      const payload = existing
        ? { ...rest, party_id }
        : { kyc_status, face_match, liveness, sanctions_hit, phone_verified,
            address_tenure_months, name, ...rest }
      const app = await api.createApplication(payload)
      setAppId(app.application_id)
      setResult(await api.decide(app.application_id))
      loadMetrics()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const book = async () => {
    if (!hasAccess) {
      setError('Access denied: You do not have permission to perform origination actions')
      return
    }
    setBusy(true)
    try { setBooked(await api.book(appId)); onBooked?.(); loadMetrics() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="grid cols-2">
      <div className="panel">
        <h2>New application</h2>
        <p className="note">Stated and verified income stay separate — the scorecard and
          affordability engine only read the verified figure. For consumer files the BTS v2
          scorecard replaces the bureau logistic at the credit gate.</p>

        <p className="eyebrow">Applicant</p>
        <div className="grid cols-2">
          <Bool id="applicant_existing" label="Existing customer" value={existing} onChange={(v) => {
            setExisting(v)
            if (v) { set('party_id', null) } else { setForm((f) => ({ ...f, ...BLANK, party_id: null })) }
          }} />
          {existing
            ? <div>
                <label htmlFor="party_id">Applicant</label>
                <select id="party_id" value={form.party_id ?? ''}
                  onChange={(e) => set('party_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{parties.length ? 'Select customer…' : 'No customers found'}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · KYC {p.kyc_status}{p.sanctions_hit ? ' · SANCTIONS HIT' : ''}
                    </option>
                  ))}
                </select>
              </div>
            : <div>
                <label htmlFor="name">Name</label>
                <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
          }
        </div>

        {!existing && (
          <>
            <p className="eyebrow">KYC evidence (new applicant)</p>
            <p className="muted">Stated by the operator — nothing is assumed. The form opens
              conservative (sanctions un-cleared, phone unverified); flip each to the verified fact.</p>
            <div className="grid cols-2">
              <div>
                <label htmlFor="kyc_status">KYC status</label>
                <select id="kyc_status" value={form.kyc_status} onChange={(e) => set('kyc_status', e.target.value)}>
                  <option value="VERIFIED">Verified</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="EDD">Enhanced due diligence</option>
                </select>
              </div>
              {KYC_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input id={key} type="number" step="any" value={form[key]}
                    onChange={(e) => set(key, Number(e.target.value))} />
                </div>
              ))}
              <Bool id="phone_verified" label="Phone verified" value={form.phone_verified} onChange={(v) => set('phone_verified', v)} />
              <Bool id="sanctions_hit" label="Sanctions hit" value={form.sanctions_hit} onChange={(v) => set('sanctions_hit', v)} />
            </div>
          </>
        )}

        <p className="eyebrow">Product</p>
        <div className="grid cols-2">
          <div>
            <label htmlFor="product">Product</label>
            <select id="product" value={form.product} onChange={(e) => set('product', e.target.value)}>
              <option value="UNSECURED">Unsecured</option>
              <option value="SECURED">Secured</option>
            </select>
          </div>
          <div>
            <label htmlFor="collateral_value">Collateral value{form.product === 'SECURED' ? ' (required)' : ''}</label>
            <input id="collateral_value" type="number" step="any" min="0" value={form.collateral_value}
              onChange={(e) => set('collateral_value', Number(e.target.value))} />
          </div>
        </div>

        <p className="eyebrow">Income and affordability</p>
        <div className="grid cols-2">
          {INCOME_FIELDS.map(([key, label]) => (
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
          <Bool id="salary_domiciled" label="Salary domiciled with us" value={form.salary_domiciled} onChange={(v) => set('salary_domiciled', v)} />
        </div>

        <p className="eyebrow">Bureau, device and documents</p>
        <div className="grid cols-2">
          {BUREAU_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key}>{label}</label>
              <input id={key} type="number" step="any" value={form[key]}
                onChange={(e) => set(key, Number(e.target.value))} />
            </div>
          ))}
          <Bool id="ip_geo_mismatch" label="IP vs KYC geo mismatch" value={form.ip_geo_mismatch} onChange={(v) => set('ip_geo_mismatch', v)} />
        </div>

        {metricsLoading && <p>Loading origination metrics...</p>}
        {metricsError && <p className="error">{metricsError}</p>}
        {metrics && <MetricsPanel metrics={metrics} />}

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
              <Empty>Submit a file to see gates G1–G9, the BTS v2 breakdown for consumer
                files (bands, domains, poor-twin diagnostic, DIY actions), which constraint
                bound the limit, the priced offer, and how collectable this borrower would
                be if the loan ever went bad.</Empty>
            </div>
        }
      </div>
    </div>
  )
}

function Bool({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">Yes</option><option value="false">No</option>
      </select>
    </div>
  )
}

function MetricsPanel({ metrics }) {
  const m = metrics?.metrics || {}
  const vol = m.application_volume || {}
  const docs = m.document_processing || {}
  const dq = m.data_quality || {}
  return (
    <div className="metrics-panel">
      <h3>Origination metrics</h3>
      <div><strong>Applications today / week</strong>
        <span>{vol.daily?.value ?? 0} · {vol.weekly?.value ?? 0}</span></div>
      <div><strong>Documents processed</strong>
        <span>{docs.total_documents_processed?.value ?? 0} · {docs.acceptance_rate?.value ?? 0}% accepted</span></div>
      <div><strong>Average tamper score</strong>
        <span>{docs.average_tamper_score?.value ?? 0}</span></div>
      <div><strong>Data quality gaps</strong>
        <span>{dq.missing_verified_income?.value ?? 0} unverified income · {dq.missing_bureau_data?.value ?? 0} no bureau</span></div>
    </div>
  )
}

function DecisionRecord({ res, onBook, booked, busy }) {
  const gates = Object.entries(res.gates || {})
  const declined = res.decision === 'DECLINE'
  const bts = res.scorecard?.bts  // consumer files only (decisioning mapper attaches BTSResult)

  return (
    <>
      <div className="panel">
        <h2>Decision</h2>
        <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px' }}>
          <Tag tone={decisionTone(res.decision)}>{res.decision}</Tag>
          <span className="mono">grade {res.grade} · 12-month PD {pct(res.pd_12m, 2)}</span>
        </p>

        {bts && <BtsPanel bts={bts} />}

        <p className="eyebrow">Gates</p>
        {gates.map(([key, gate]) => (
          <div className="gate" key={key}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {gate.pass
                ? <CheckCircle2 size={15} color="var(--ok)" />
                : <XCircle size={15} color="var(--bad)" />}
              {prettify(key)}
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
            {Object.entries(res.model_versions).map(([k, v]) => `${k} ${v}`).join(' · ')}
          </p>
        </div>
      </div>
    </>
  )
}

function BtsPanel({ bts }) {
  return (
    <>
      <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px' }}>
        <Tag tone={btsTone(bts.tier)}>BTS {bts.bts}</Tag>
        <span className="mono">tier {bts.tier} · partner map {bts.partner_map} · {bts.file_class}
          {bts.confidence_badge ? ` · confidence ${bts.confidence_badge}` : ''}</span>
      </p>

      <p className="eyebrow">BTS v2 characteristics (band · points / available)</p>
      <div className="inset mono">
        {bts.characteristics.map((c) => (
          <div key={c.char_id} title={c.rationale}>
            {c.char_id} · band {c.band}{c.source === 'OVERRIDE' ? ' (override)' : ''} · {c.pts}/{c.max_pts}
          </div>
        ))}
      </div>

      <p className="eyebrow">Domain budgets used</p>
      <div className="inset mono">
        {Object.entries(bts.domains).map(([domain, d]) => (
          <div key={domain}>{domain}: {d.pts}/{d.budget} ({pct(d.used, 1)})</div>
        ))}
      </div>

      <p className="eyebrow">Poor-twin diagnostic (same file, every observed band forced E)</p>
      <p className="mono">poor twin {bts.poor_twin_bts} ({bts.poor_twin_tier}) — the gap proves
        the card scores quality, not presence</p>

      {bts.reasons?.length > 0 && (
        <>
          <p className="eyebrow">How to improve this score</p>
          <div className="inset mono">
            {bts.reasons.map((rc) => (
              <div key={rc.code} title={rc.language}>
                {rc.code} · {rc.label}: {rc.action} ({rc.est_pts})
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
