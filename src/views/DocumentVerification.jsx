import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck, Banknote, CheckCircle2, FileCheck2, FileSpreadsheet, FileText,
  FileUp, IdCard, RefreshCw, Search, UploadCloud, XCircle,
} from 'lucide-react'

const COLORS = {
  green: '#176b63',
  gold: '#c08a1e',
  dark: '#1e3a2b',
  muted: '#5d6b66',
  red: '#9e2b2b',
  bg: '#f0f2f1',
  border: '#e1e6e2',
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('accessToken')
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: authHeaders(options.headers || {}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || body.error || `Request failed (${response.status})`)
  return body
}

const scoreTone = (value) => {
  const n = Number(value || 0)
  if (n >= 70) return { color: COLORS.red, label: 'High' }
  if (n >= 35) return { color: COLORS.gold, label: 'Review' }
  return { color: COLORS.green, label: 'Low' }
}

// Document catalogue: what the upload panel expects for each slot — types,
// size ceiling, and the plain-language instruction shown to the operator.
const MAX_FILE_MB = 5
const DOC_SLOTS = [
  {
    key: 'IDENTITY',
    label: 'Identity document',
    icon: IdCard,
    idTypeField: true,          // National ID vs Passport picker
    types: ['National ID', 'Passport'],
    accept: '.pdf,.png,.jpg,.jpeg,.webp',
    hint: 'Scan or photo of the ID page. PDF, PNG, JPG or WEBP up to 5 MB.',
  },
  {
    key: 'INCOME',
    label: 'Income document',
    icon: Banknote,
    idTypeField: false,
    types: ['M-Pesa statement', 'Bank statement'],
    accept: '.pdf',
    hint: 'Last 3 months of statements. PDF only, up to 5 MB.',
  },
  {
    key: 'BUREAU_REPORT',
    label: 'Bureau report',
    icon: FileSpreadsheet,
    idTypeField: false,
    types: null,
    accept: '.pdf',
    hint: 'CRB report pulled within the last 30 days. PDF only, up to 5 MB.',
  },
  {
    key: 'OTHER',
    label: 'Other supporting document',
    icon: FileText,
    idTypeField: false,
    types: null,
    accept: '.pdf,.png,.jpg,.jpeg,.webp',
    hint: 'Payslips, utility bills, collateral documents, etc. PDF or image up to 5 MB.',
  },
]

function Metric({ label, value, suffix = '', tone }) {
  return (
    <div className="soft2" style={{ padding: 16 }}>
      <div className="note">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 750, color: tone || COLORS.dark, marginTop: 5 }}>
        {value}{suffix}
      </div>
    </div>
  )
}

function Pill({ children, tone = COLORS.green }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
      borderRadius: 999, background: `${tone}16`, color: tone, fontSize: 12, fontWeight: 700,
    }}>{children}</span>
  )
}

// One upload slot in Panel 2: catalogue row + optional ID/income-type picker,
// file picker with type/size validation, and per-slot status.
function DocSlot({ slot, value, onChange, uploaded }) {
  const Icon = slot.icon
  const error = value.error
  return (
    <div className="soft" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={17} style={{ color: COLORS.green }} />
        <strong style={{ flex: 1 }}>{slot.label}</strong>
        {uploaded
          ? <Pill><CheckCircle2 size={13} /> on file</Pill>
          : <span className="note" style={{ margin: 0 }}>required</span>}
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
        <div style={{ border: `1px dashed ${COLORS.border}`, borderRadius: 10, padding: 12, marginTop: 5, textAlign: 'center' }}>
          <UploadCloud size={20} style={{ color: COLORS.green }} />
          <input
            type="file"
            accept={slot.accept}
            onChange={(e) => onChange(slot.key, { ...value, file: e.target.files?.[0] || null, error: null })}
            style={{ display: 'block', margin: '8px auto 0' }}
          />
          {value.file && <span className="note">{value.file.name} · {(value.file.size / 1024 / 1024).toFixed(2)} MB</span>}
          {uploaded && <span className="note">Last upload: {uploaded.original_filename || uploaded.mime}</span>}
        </div>
      </label>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}

export default function DocumentVerification({ initialSeed, userProfile }) {
  const [applicants, setApplicants] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seedBusy, setSeedBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  // Panel 2 state: one slot value per catalogue entry {file, idType/incomeType, error}
  const [slots, setSlots] = useState(() => Object.fromEntries(DOC_SLOTS.map((s) => [s.key, { file: null, idType: 'National ID', incomeType: 'M-Pesa statement', error: null }])))
  const formRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return applicants
    return applicants.filter((a) => `${a.name} ${a.app_id}`.toLowerCase().includes(q))
  }, [applicants, query])

  const loadApplicants = async () => {
    const data = await request('/api/document-verification/applicants/')
    setApplicants(data.results || data)
    if (!selectedId && (data.results || data).length) setSelectedId((data.results || data)[0].app_id)
  }

  const loadResult = async (appId) => {
    if (!appId) return
    setLoading(true); setError(null)
    try { setResult(await request(`/api/document-verification/applicants/${appId}/`)) }
    catch (e) { setError(e.message); setResult(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadApplicants().catch((e) => setError(e.message)) }, [])
  useEffect(() => { loadResult(selectedId) }, [selectedId])
  useEffect(() => {
    if (initialSeed?.applicants?.length) {
      loadApplicants().then(() => {
        const id = initialSeed.applicants[0]?.app_id
        if (id) setSelectedId(id)
      }).catch((e) => setError(e.message))
    }
  }, [initialSeed])

  // Reset the upload slots whenever a different application is selected.
  useEffect(() => {
    setSlots(Object.fromEntries(DOC_SLOTS.map((s) => [s.key, { file: null, idType: 'National ID', incomeType: 'M-Pesa statement', error: null }])))
  }, [selectedId])

  const seedDocuments = async () => {
    setSeedBusy(true); setError(null); setMessage(null)
    try {
      const data = await request('/api/document-verification/seed/', { method: 'POST' })
      setMessage(`Seeded ${data.created || data.applicants?.length || 0} applicant document package(s).`)
      await loadApplicants()
      if (data.applicants?.[0]?.app_id) setSelectedId(data.applicants[0].app_id)
    } catch (e) { setError(e.message) }
    finally { setSeedBusy(false) }
  }

  const setSlot = (key, patch) => setSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  // Client-side gate before any upload: file present, extension allowed, size ceiling.
  const validateSlot = (slot, value) => {
    if (!value.file) return 'Choose a file to upload.'
    const ext = `.${value.file.name.split('.').pop().toLowerCase()}`
    if (!slot.accept.split(',').includes(ext)) return `File type ${ext} is not accepted for ${slot.label} (allowed: ${slot.accept}).`
    if (value.file.size > MAX_FILE_MB * 1024 * 1024) return `File exceeds the ${MAX_FILE_MB} MB limit (${(value.file.size / 1024 / 1024).toFixed(1)} MB).`
    return null
  }

  // Submit: validate every filled slot, ingest each in turn, then refresh.
  const submitVerification = async (e) => {
    e.preventDefault()
    if (!selectedId) { setError('Select an application first.'); return }
    const filled = DOC_SLOTS.filter((s) => slots[s.key].file)
    if (!filled.length) { setError('Attach at least one document to submit.'); return }
    for (const s of filled) {
      const err = validateSlot(s, slots[s.key])
      if (err) { setSlot(s.key, { error: err }); return }
    }
    setSubmitBusy(true); setError(null); setMessage(null)
    try {
      for (const s of filled) {
        const form = new FormData()
        form.append('app_id', selectedId)
        form.append('doc_type', s.key)
        // Type pickers ride along as the source label so the audit trail shows
        // National ID vs Passport / M-Pesa vs bank statement.
        const typePick = s.idTypeField ? slots[s.key].idType : (s.types ? slots[s.key].incomeType : null)
        form.append('source', typePick ? `${typePick} (upload)` : 'upload')
        form.append('file', slots[s.key].file)
        await request('/api/document-verification/documents/', { method: 'POST', body: form })
      }
      setSlots(Object.fromEntries(DOC_SLOTS.map((s) => [s.key, { file: null, idType: slots[s.key].idType, incomeType: slots[s.key].incomeType, error: null }])))
      setMessage(`Ingested and verified ${filled.length} document${filled.length > 1 ? 's' : ''}. Forensic checks and the fraud score have been refreshed.`)
      await loadResult(selectedId)
    } catch (err) { setError(err.message) }
    finally { setSubmitBusy(false) }
  }

  const refresh = () => loadResult(selectedId)

  const score = result?.fraud_score
  const tone = scoreTone(score?.composite)
  const app = result?.application
  const onFile = (docType) => (result?.documents || []).find((d) => d.doc_type === docType)

  return (
    <div className="grid">
      <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 style={{ marginBottom: 4 }}>Document Verification & Fraud</h2>
          <p className="note">Ingest immutable document evidence, run forensic checks, consolidate fraud signals, and review the applicant outcome.</p>
        </div>
        <button className="btn brass" onClick={seedDocuments} disabled={seedBusy || loading}>
          <FileCheck2 size={15} /> {seedBusy ? 'Seeding…' : 'Seed Documents'}
        </button>
        <button className="btn ghost" onClick={refresh} disabled={!selectedId || loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {message && <p style={{ color: COLORS.green, margin: 0 }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid cols-2">
        {/* Panel 1 — Application details */}
        <div className="panel">
          <h2>Application details</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: COLORS.muted }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or application ID" style={{ paddingLeft: 32, width: '100%' }} />
            </div>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select application</option>
              {filtered.map((a) => <option key={a.app_id} value={a.app_id}>{a.name} — {a.app_id.slice(0, 8)}</option>)}
            </select>
          </div>
          {result && app ? (
            <div className="soft" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <BadgeCheck size={17} style={{ color: COLORS.green }} />
                <strong style={{ fontSize: 15 }}>{app.application_number || `APP-${result.app_id.slice(0, 8).toUpperCase()}`}</strong>
                <Pill>{app.status}</Pill>
              </div>
              <table><tbody>
                <tr><td>Product</td><td className="right mono">{app.product || '—'}</td></tr>
                <tr><td>Applicant</td><td className="right">{result.applicant?.name}</td></tr>
                <tr><td>Amount requested</td><td className="right mono">KES {Number(app.amount_requested || 0).toLocaleString()}</td></tr>
                <tr><td>Loan tenure</td><td className="right mono">{app.tenure || 0} months</td></tr>
                <tr><td>Purpose</td><td className="right">{app.purpose || '—'}</td></tr>
                <tr><td>Channel</td><td className="right mono">{app.channel}</td></tr>
                <tr><td>Declared income</td><td className="right mono">{result.declaration?.income != null ? `KES ${Number(result.declaration.income).toLocaleString()}` : '—'}</td></tr>
                <tr><td>Employment</td><td className="right">{result.declaration?.employment || '—'}</td></tr>
                <tr><td>Bureau score</td><td className="right mono">{result.applicant?.bureau_score ?? '—'}</td></tr>
              </tbody></table>
            </div>
          ) : <p className="note">{loading ? 'Loading…' : 'Seed or select an application to view its details.'}</p>}
        </div>

        {/* Panel 2 — Application documents + submit */}
        <form className="panel" onSubmit={submitVerification} ref={formRef}>
          <h2>Application documents</h2>
          <p className="note">
            Upload the documents the loan file needs. Files are hashed and stored immutably; each upload
            triggers a forensic check run. Accepted: PDF or image (PDF only for income and bureau report),
            max {MAX_FILE_MB} MB per file.
          </p>
          {DOC_SLOTS.map((slot) => (
            <DocSlot
              key={slot.key}
              slot={slot}
              value={slots[slot.key]}
              onChange={setSlot}
              uploaded={onFile(slot.key)}
            />
          ))}
          <button className="btn" type="submit" disabled={submitBusy || loading || !selectedId} style={{ marginTop: 4 }}>
            <FileUp size={15} /> {submitBusy ? 'Verifying…' : 'Submit for verification'}
          </button>
          {!selectedId && <p className="note" style={{ marginTop: 8 }}>Select an application above to enable submission.</p>}
        </form>
      </div>

      {result && (
        <>
          <div className="grid cols-4">
            <Metric label="Composite fraud score" value={Number(score?.composite || 0).toFixed(1)} suffix=" / 100" tone={tone.color} />
            <Metric label="First-party" value={Number(score?.first_party || 0).toFixed(1)} suffix=" / 100" />
            <Metric label="Third-party" value={Number(score?.third_party || 0).toFixed(1)} suffix=" / 100" />
            <Metric label="Synthetic" value={Number(score?.synthetic || 0).toFixed(1)} suffix=" / 100" />
          </div>

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div><h2>Fraud decision</h2><p className="note">Fusion layer output from document forensics and fraud signals.</p></div>
              <Pill tone={tone.color}>{score?.decision || 'REVIEW'} · {tone.label}</Pill>
            </div>
            <div className="grid cols-2" style={{ marginTop: 12 }}>
              <div>
                <h3>DOC_FORENSIC</h3>
                <table><thead><tr><th>Check</th><th className="right">Value</th></tr></thead><tbody>
                  {(result.doc_forensic || []).map((row) => <tr key={row.id}><td>{row.check_type || 'Run'} <span className="note">#{row.id}</span></td><td className="right mono">Tamper {Number(row.tamper_score).toFixed(2)} · Meta {row.metadata_anomaly ? 'Yes' : 'No'} · Template {Number(row.template_match).toFixed(2)} · Vendor {Number(row.vendor_score).toFixed(2)}</td></tr>)}
                </tbody></table>
              </div>
              <div>
                <h3>FRAUD_SIGNAL</h3>
                <table><thead><tr><th>Signal</th><th>Severity</th><th>Source</th><th className="right">Value</th></tr></thead><tbody>
                  {(result.fraud_signals || []).map((s) => <tr key={s.id}><td className="mono">{s.signal_code}</td><td><Pill tone={s.severity === 'HIGH' ? COLORS.red : s.severity === 'MEDIUM' ? COLORS.gold : COLORS.green}>{s.severity}</Pill></td><td>{s.source}</td><td className="right mono">{String(s.value)}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Documents on file</h2>
            <table><thead><tr><th>Type</th><th>Source</th><th>MIME</th><th>Hash</th><th>Verified</th></tr></thead><tbody>
              {(result.documents || []).map((d) => <tr key={d.doc_id}><td>{d.doc_type}</td><td>{d.source}</td><td>{d.mime}</td><td className="mono">{d.hash?.slice(0, 18)}…</td><td>{d.verified ? <CheckCircle2 size={16} style={{ color: COLORS.green }} /> : <XCircle size={16} style={{ color: COLORS.red }} />}</td></tr>)}
            </tbody></table>
          </div>
        </>
      )}
    </div>
  )
}
