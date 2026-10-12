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
// reuses their stored KYC evidence. A BUSINESS (ORG) applicant states the sheet-13
// SME evidence groups instead of the consumer KYC block; the backend scores the
// business card (hybrid: SME tier drives the offer, the logistic PD stays at G6).
const SME_BLANK_EVIDENCE = {
  consent: true,
  trade_repayment: { months_observed: 12, months_on_time: 7, delays_30d: 2, disputes: 0 },
  owner_obligations: [{ family: 'Electricity', months_observed: 10, on_time_ratio: 0.92 }],
  rail: { months_active: 12, reversal_rate: 0.01 },
  till: { months_observed: 12, inflow_cv: 0.5, seasonal_explained: false },
  adequacy: { net_inflow_multiple: 2.5 },
  trajectory: { months_observed: 12, falling_months: 0, stepdown_ratio: 0.0, trend: 'FLAT' },
  identity: { observed: true, registration: true, tax_current: false, beneficial_owners: false,
              address: true, sim_match: true, name_consistency_observed: true, name_changes: 1 },
  market: { chair_confirms: true, association_months: 6 },
  tenure: { months: 3, autopay_performing: false, autopay_live: false, autopay_failed: false },
  formalisation: { observed: true, registered: true, tax_current: true, ref_count: 1, ref_quality: 'fair' },
}

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
  party_id: null, party_type: 'IND',
  sme_evidence: SME_BLANK_EVIDENCE,
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
      const org = form.party_type === 'ORG'
      // The backend takes either party_id (KYC evidence reused) or the full KYC
      // statement — never both. party_id is destructured out so a new-applicant
      // submit never posts the blank form's null (the backend would refuse it).
      // Segment-consistent payloads: an ORG file carries the SME evidence groups
      // (and the party_type the backend mirrors onto the Party row), an IND file
      // carries the consumer KYC block — never both.
      const { kyc_status, face_match, liveness, sanctions_hit, phone_verified,
              address_tenure_months, name, party_id, party_type, sme_evidence, ...rest } = form
      const payload = org
        ? (existing
            ? { party_id, party_type, sme_evidence, ...rest }
            : { kyc_status, face_match, liveness, sanctions_hit, phone_verified,
                address_tenure_months, name, party_type, sme_evidence, ...rest })
        : (existing
            ? { ...rest, party_id }
            : { kyc_status, face_match, liveness, sanctions_hit, phone_verified,
                address_tenure_months, name, ...rest })
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
    <div className="grid cols-2 w-[98vw] mx-auto">
      <div className="panel">
        <h1>New application</h1>
        <p className="note">Stated and verified income stay separate — the scorecard and
          affordability engine only read the verified figure. Consumer files run the BTS v2
          card, business files the SME card — each replaces the bureau logistic at the
          credit gate (the logistic PD stays at G6 and pricing).</p>

        <p className="eyebrow">Applicant</p>
        <div className="grid cols-2">
          <div>
            <label htmlFor="party_type">Applicant type</label>
            <select id="party_type" value={form.party_type}
              disabled={existing}
              onChange={(e) => set('party_type', e.target.value)}>
              <option value="IND">Individual</option>
              <option value="ORG">Business</option>
            </select>
          </div>
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
                      {p.name} · {p.party_type === 'ORG' ? 'Business' : 'Individual'} · KYC {p.kyc_status}{p.sanctions_hit ? ' · SANCTIONS HIT' : ''}
                    </option>
                  ))}
                </select>
              </div>
            : <div>
                <label htmlFor="name">{form.party_type === 'ORG' ? 'Business name' : 'Name'}</label>
                <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
          }
        </div>

        {!existing && form.party_type === 'ORG' && (
          <SmeEvidenceFields form={form} set={set} />
        )}

        {!existing && form.party_type === 'IND' && (
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
        {existing && form.party_type === 'ORG' && (
          <SmeEvidenceFields form={form} set={set} />
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
              <Empty>Submit a file to see gates G1–G9, the scorecard breakdown for the
                applicant's segment (bands, domains, poor-twin diagnostic, DIY actions),
                which constraint bound the limit, the priced offer, and how collectable
                this borrower would be if the loan ever went bad.</Empty>
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

// One row of the sheet-13 SME evidence editor: updates a single key inside
// sme_evidence[group] (or an owner-obligation array row) without touching the rest.
function SmeField({ label, type = 'number', value, onChange }) {
  if (type === 'bool') return <Bool label={label} value={value} onChange={onChange} />
  return (
    <div>
      <label>{label}</label>
      <input type={type} step="any" value={value} onChange={(e) => onChange(
        e.target.type === 'number' ? Number(e.target.value) : e.target.value)} />
    </div>
  )
}

function SmeSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  )
}

// Sheet-13 evidence groups, stated by the operator — every key the business
// card's band ladders read (risk_engine/bts/sme_bands.py). Unstated evidence
// bands M (0 pts, excluded from available_max) — absence never dilutes.
function SmeEvidenceFields({ form, set }) {
  const ev = form.sme_evidence || {}
  const g = (group, key) => (ev[group] || {})[key]
  // set inside one evidence group, preserving the other groups (consent sits at
  // the top level of sme_evidence, beside the groups)
  const setEv = (patch) => set('sme_evidence', { ...ev, ...patch })
  const setG = (group, patch) => setEv({ [group]: { ...ev[group], ...patch } })
  const setObli = (i, key, v) => setEv({
    owner_obligations: ev.owner_obligations.map((o, j) => (j === i ? { ...o, [key]: v } : o)),
  })
  const obli = ev.owner_obligations?.[0] || {}
  return (
    <>
      <p className="eyebrow">Business evidence (SME scorecard)</p>
      <p className="muted">Stated by the operator — nothing is assumed. The business card
        bands each group; unobserved groups band M and never dilute what is observed.</p>
      <div className="grid cols-2">
        <Bool label="Consent to data use" value={ev.consent ?? true} onChange={(v) => setEv({ consent: v })} />
        <SmeField label="Trade: months observed" value={g('trade_repayment', 'months_observed') ?? 0}
          onChange={(v) => setG('trade_repayment', { months_observed: v })} />
        <SmeField label="Trade: months on time" value={g('trade_repayment', 'months_on_time') ?? 0}
          onChange={(v) => setG('trade_repayment', { months_on_time: v })} />
        <SmeField label="Trade: 30-day delays" value={g('trade_repayment', 'delays_30d') ?? 0}
          onChange={(v) => setG('trade_repayment', { delays_30d: v })} />
        <SmeField label="Trade: disputes on file" value={g('trade_repayment', 'disputes') ?? 0}
          onChange={(v) => setG('trade_repayment', { disputes: v })} />
        <SmeField label="Owner obligation family" type="text" value={obli.family || ''}
          onChange={(v) => setObli(0, 'family', v)} />
        <SmeField label="Owner obligation: months" value={obli.months_observed ?? 0}
          onChange={(v) => setObli(0, 'months_observed', v)} />
        <SmeField label="Owner obligation: on-time ratio (0–1)" value={obli.on_time_ratio ?? 0}
          onChange={(v) => setObli(0, 'on_time_ratio', v)} />
        <SmeField label="Rail: months active" value={g('rail', 'months_active') ?? 0}
          onChange={(v) => setG('rail', { months_active: v })} />
        <SmeField label="Rail: reversal rate (0–1)" value={g('rail', 'reversal_rate') ?? 0}
          onChange={(v) => setG('rail', { reversal_rate: v })} />
        <SmeField label="Till: months observed" value={g('till', 'months_observed') ?? 0}
          onChange={(v) => setG('till', { months_observed: v })} />
        <SmeField label="Till: inflow CV" value={g('till', 'inflow_cv') ?? 0}
          onChange={(v) => setG('till', { inflow_cv: v })} />
        <SmeField type="bool" label="Till: seasonal but explained" value={g('till', 'seasonal_explained') ?? false}
          onChange={(v) => setG('till', { seasonal_explained: v })} />
        <SmeField label="Adequacy: net inflow × instalment" value={g('adequacy', 'net_inflow_multiple') ?? 0}
          onChange={(v) => setG('adequacy', { net_inflow_multiple: v })} />
        <SmeField label="Trajectory: months observed" value={g('trajectory', 'months_observed') ?? 0}
          onChange={(v) => setG('trajectory', { months_observed: v })} />
        <SmeField label="Trajectory: falling months" value={g('trajectory', 'falling_months') ?? 0}
          onChange={(v) => setG('trajectory', { falling_months: v })} />
        <SmeField label="Trajectory: step-down ratio (0–1)" value={g('trajectory', 'stepdown_ratio') ?? 0}
          onChange={(v) => setG('trajectory', { stepdown_ratio: v })} />
        <SmeSelect label="Trajectory: trend" value={g('trajectory', 'trend') || 'FLAT'}
          options={[['FLAT', 'Flat'], ['RISING', 'Rising'], ['FALLING', 'Falling']]}
          onChange={(v) => setG('trajectory', { trend: v })} />
        <SmeField type="bool" label="Identity: registered" value={g('identity', 'registration') ?? false}
          onChange={(v) => setG('identity', { observed: true, registration: v })} />
        <SmeField type="bool" label="Identity: tax current" value={g('identity', 'tax_current') ?? false}
          onChange={(v) => setG('identity', { observed: true, tax_current: v })} />
        <SmeField type="bool" label="Identity: beneficial owners verified" value={g('identity', 'beneficial_owners') ?? false}
          onChange={(v) => setG('identity', { observed: true, beneficial_owners: v })} />
        <SmeField type="bool" label="Identity: address confirmed" value={g('identity', 'address') ?? false}
          onChange={(v) => setG('identity', { observed: true, address: v })} />
        <SmeField type="bool" label="Identity: SIM registered to business" value={g('identity', 'sim_match') ?? false}
          onChange={(v) => setG('identity', { observed: true, sim_match: v })} />
        <SmeField label="Identity: name changes across sources" value={g('identity', 'name_changes') ?? 0}
          onChange={(v) => setG('identity', { observed: true, name_consistency_observed: true, name_changes: v })} />
        <SmeField type="bool" label="Market: chair confirms standing" value={g('market', 'chair_confirms') ?? false}
          onChange={(v) => setG('market', { chair_confirms: v })} />
        <SmeField label="Market: association months" value={g('market', 'association_months') ?? 0}
          onChange={(v) => setG('market', { association_months: v })} />
        <SmeField label="Tenure: months on platform" value={g('tenure', 'months') ?? 0}
          onChange={(v) => setG('tenure', { months: v })} />
        <SmeField type="bool" label="Tenure: auto-pay performing" value={g('tenure', 'autopay_performing') ?? false}
          onChange={(v) => setG('tenure', { autopay_performing: v })} />
        <SmeField type="bool" label="Formalisation: registered" value={g('formalisation', 'registered') ?? false}
          onChange={(v) => setG('formalisation', { observed: true, registered: v })} />
        <SmeField type="bool" label="Formalisation: tax current" value={g('formalisation', 'tax_current') ?? false}
          onChange={(v) => setG('formalisation', { observed: true, tax_current: v })} />
        <SmeField label="Formalisation: trade references" value={g('formalisation', 'ref_count') ?? 0}
          onChange={(v) => setG('formalisation', { observed: true, ref_count: v })} />
        <SmeSelect label="Formalisation: reference quality" value={g('formalisation', 'ref_quality') || 'none'}
          options={[['none', 'None stated'], ['fair', 'Fair'], ['strong', 'Strong']]}
          onChange={(v) => setG('formalisation', { observed: true, ref_quality: v })} />
      </div>
    </>
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
  const bts = res.scorecard?.bts  // both segments (decisioning mapper attaches the segment's BTSResult)

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

      <p className="eyebrow">Scorecard characteristics (band · points / available)</p>
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

      <p className="eyebrow">Poor-twin diagnostic (same file, bands floored at the poor mark)</p>
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
