import {
  CheckCircle2, FileSpreadsheet, FileText,
  IdCard, Banknote, UploadCloud, Fingerprint,
} from 'lucide-react'
import { prettify } from '../lib/format'

// Document catalogue, copied from DocumentVerification.jsx: what each upload slot
// expects — types, size ceiling, and the plain-language instruction to the operator.
export const MAX_FILE_MB = 12
// Product options for the named-product picker. PERSONAL_LOAN is the standard
// retail product; the others mirror the loan product catalogue (shared with
// doc_verification's picker). The engine reads only the Product class below
// (UNSECURED/SECURED) — the named product rides along as metadata.
const PRODUCT_OPTIONS = [
  'PERSONAL_LOAN',
  'BUSINESS_LOAN',
  'LOGBOOK_LOAN',
  'SALARY_ADVANCE',
  'ASSET_FINANCE',
  'MORTGAGE',
  'EDUCATION_LOAN',
  'DIGITAL_LOAN',
]

export const DOC_SLOTS = [
  {
    key: 'IDENTITY',
    label: 'Identity document',
    icon: IdCard,
    idTypeField: true,          // National ID vs Passport picker
    types: ['National ID', 'Passport'],
    accept: '.pdf,.png,.jpg,.jpeg,.webp',
    hint: 'Scan or photo of the ID page. PDF, PNG, JPG or WEBP up to 12 MB.',
  },
  {
    key: 'INCOME',
    label: 'Income document',
    icon: Banknote,
    idTypeField: false,
    types: ['M-Pesa statement', 'Bank statement'],
    accept: '.pdf',
    hint: 'Last 3 months of statements. PDF only, up to 12 MB.',
  },
  {
    key: 'BUREAU_REPORT',
    label: 'Bureau report',
    icon: FileSpreadsheet,
    idTypeField: false,
    types: null,
    accept: '.pdf',
    hint: 'CRB report pulled within the last 30 days. PDF only, up to 12 MB.',
  },
  {
    key: 'OTHER',
    label: 'Other supporting document',
    icon: FileText,
    idTypeField: false,
    types: null,
    accept: '.pdf,.png,.jpg,.jpeg,.webp',
    hint: 'Payslips, utility bills, collateral documents, etc. PDF or image up to 12 MB.',
  },
]

// Demo document extraction (stands in for the real document pipeline): when
// "Run decision" ingests the uploaded documents, each slot contributes these
// facts. A missing document leaves its contribution out and the decision panel
// shows the field as not extracted.
export const DEMO_EXTRACTION = {
  IDENTITY: { kyc_status: 'VERIFIED', sanctions_hit: false },
  INCOME: {
    stated_income: 95000, verified_income: 95000, existing_debt_service: 9000,
    doc_source: 'AA', phone_verified: true, salary_domiciled: true,
  },
  BUREAU_REPORT: {
    bureau_score: 690, bureau_enquiries_6m: 2, delinquencies_12m: 0, bounces_6m: 0,
  },
  OTHER: { device_apps_24h: 1, tamper_score: 0.08, ip_geo_mismatch: false },
}

// Client-side gate for one upload slot (shared with the container's decide flow
// in Originate.jsx): file present, extension allowed, size ceiling.
export const validateSlot = (slot, value) => {
  if (!value.file) return 'Choose a file to upload.'
  const ext = `.${value.file.name.split('.').pop().toLowerCase()}`
  if (!slot.accept.split(',').includes(ext)) return `File type ${ext} is not accepted for ${slot.label} (allowed: ${slot.accept}).`
  if (value.file.size > MAX_FILE_MB * 1024 * 1024) return `File exceeds the ${MAX_FILE_MB} MB limit (${(value.file.size / 1024 / 1024).toFixed(1)} MB).`
  return null
}

// "New application" panel: applicant, loan details, document uploads and the
// module metrics. All state lives in the container (Originate.jsx) — this panel
// is presentational and fires onDecide ("Run decision").
export default function OriginateApplication({
  form, set, resetForm, existing, setExisting, parties, partySearch, setPartySearch,
  docSlots, setSlot, metrics, metricsLoading, metricsError, busy, error, onDecide,
}) {
  return (
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
          if (v) { set('party_id', null) } else { resetForm() }
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

      <p className="eyebrow">Loan details</p>
      <div className="grid cols-2">
        <div>
          <label htmlFor="product_name">Product name</label>
          <select id="product_name" value={form.product_name}
            onChange={(e) => set('product_name', e.target.value)}>
            {PRODUCT_OPTIONS.map((p) => (
              <option key={p} value={p}>{prettify(p)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product_type">Product type</label>
          <select id="product_type" value={form.product} onChange={(e) => set('product', e.target.value)}>
            <option value="UNSECURED">Unsecured</option>
            <option value="SECURED">Secured</option>
          </select>
        </div>
        <div>
          <label htmlFor="collateral_value">Collateral value{form.product === 'SECURED' ? ' (required)' : ''}</label>
          <input id="collateral_value" type="number" step="any" min="0" value={form.collateral_value}
            onChange={(e) => set('collateral_value', Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="amount_requested">Amount requested</label>
          <input id="amount_requested" type="number" step="any" value={form.amount_requested}
            onChange={(e) => set('amount_requested', Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="tenure_months">Tenure (months)</label>
          <input id="tenure_months" type="number" step="any" value={form.tenure_months}
            onChange={(e) => set('tenure_months', Number(e.target.value))} />
        </div>
        <Bool id="salary_domiciled" label="Salary domiciled with us" value={form.salary_domiciled} onChange={(v) => set('salary_domiciled', v)} />
      </div>

      <p className="eyebrow">Application documents</p>
      <p className="muted">Files are hashed and stored immutably; each upload triggers a
        forensic check run. Accepted: PDF or image (PDF only for income and bureau
        report), max {MAX_FILE_MB} MB per file. KYC, income and bureau facts are
        extracted from these documents when the decision runs.</p>
      {DOC_SLOTS.map((slot) => (
        <DocSlot key={slot.key} slot={slot} value={docSlots[slot.key]} onChange={setSlot} />
      ))}

      {metricsLoading && <p>Loading origination metrics...</p>}
      {metricsError && <p className="error">{metricsError}</p>}
      {metrics && <MetricsPanel metrics={metrics} />}

      <p style={{ marginTop: 18 }}>
        <button className="btn" disabled={busy} onClick={onDecide}>
          <Fingerprint size={16} /> {busy ? 'Deciding…' : 'Run decision'}
        </button>
      </p>
      {error && <p className="error">{error}</p>}
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

// One upload slot of the document catalogue (copied from DocumentVerification.jsx):
// catalogue row + optional ID/income-type picker, file picker with type/size
// validation, and per-slot status.
function DocSlot({ slot, value, onChange }) {
  const Icon = slot.icon
  return (
    <div className="soft" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={17} />
        <strong style={{ flex: 1 }}>{slot.label}</strong>
        {value.file
          ? <span className="tag ok"><CheckCircle2 size={13} /> attached</span>
          : <span className="note" style={{ margin: 0 }}>optional</span>}
      </div>
      <p className="note" style={{ marginTop: 0 }}>{slot.hint}</p>

      {slot.idTypeField && (
        <label style={{ display: 'block', marginBottom: 8 }}>
          Identity document type
          <select value={value.idType} onChange={(e) => onChange(slot.key, { ...value, idType: e.target.value })}>
            {slot.types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      )}
      {!slot.idTypeField && slot.types && (
        <label style={{ display: 'block', marginBottom: 8 }}>
          Income document type
          <select value={value.incomeType} onChange={(e) => onChange(slot.key, { ...value, incomeType: e.target.value })}>
            {slot.types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: 'block' }}>
        <span className="note">Document file</span>
        <div style={{ border: '1px dashed var(--muted)', borderRadius: 10, padding: 12, marginTop: 5, textAlign: 'center' }}>
          <UploadCloud size={20} />
          <input
            type="file"
            accept={slot.accept}
            onChange={(e) => onChange(slot.key, { ...value, file: e.target.files?.[0] || null, error: null })}
            style={{ display: 'block', margin: '8px auto 0' }}
          />
          {value.file && <span className="note">{value.file.name} · {(value.file.size / 1024 / 1024).toFixed(2)} MB</span>}
        </div>
      </label>
      {value.error && <p className="error" style={{ marginTop: 8 }}>{value.error}</p>}
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
