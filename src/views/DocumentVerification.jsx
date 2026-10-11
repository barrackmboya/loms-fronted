import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, FileCheck2, FileUp, RefreshCw, Search,
  ShieldAlert, ShieldCheck, UploadCloud, XCircle,
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

export default function DocumentVerification({ initialSeed, userProfile }) {
  const [applicants, setApplicants] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seedBusy, setSeedBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('IDENTITY')
  const [source, setSource] = useState('upload')

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

  const uploadDocument = async (e) => {
    e.preventDefault()
    if (!file || !selectedId) return
    setLoading(true); setError(null); setMessage(null)
    try {
      const form = new FormData()
      form.append('app_id', selectedId)
      form.append('doc_type', docType)
      form.append('source', source)
      form.append('file', file)
      await request('/api/document-verification/documents/', { method: 'POST', body: form })
      setFile(null)
      // e.currentTarget.reset()
      setMessage('Document ingested and verification checks completed.')
      await loadResult(selectedId)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const score = result?.fraud_score
  const tone = scoreTone(score?.composite)

  return (
    <div className="grid">
      <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 style={{ marginBottom: 4 }}>Document Verification & Fraud</h2>
          <p className="note">Ingest immutable document evidence, run forensic checks, consolidate fraud signals, and review the applicant outcome.</p>
        </div>
        <button className="btn brass" onClick={seedDocuments} disabled={seedBusy || loading}>
          <DatabaseIcon /> {seedBusy ? 'Seeding…' : 'Seed Documents'}
        </button>
        <button className="btn ghost" onClick={() => loadResult(selectedId)} disabled={!selectedId || loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {message && <p style={{ color: COLORS.green, margin: 0 }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid cols-2">
        <div className="panel">
          <h2>Applicant</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: COLORS.muted }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or application ID" style={{ paddingLeft: 32, width: '100%' }} />
            </div>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select applicant</option>
              {filtered.map((a) => <option key={a.app_id} value={a.app_id}>{a.name} — {a.app_id}</option>)}
            </select>
          </div>
          {result ? (
            <div className="soft" style={{ padding: 16 }}>
              <strong>{result.applicant?.name}</strong>
              <div className="note" style={{ marginTop: 5 }}>{result.app_id} · {result.application?.status} · {result.application?.channel}</div>
              <div className="grid cols-3" style={{ marginTop: 14 }}>
                <Metric label="Requested" value={Number(result.application?.amount_requested || 0).toLocaleString()} />
                <Metric label="Tenure" value={result.application?.tenure || 0} suffix=" mo" />
                <Metric label="Bureau score" value={result.applicant?.bureau_score ?? '—'} />
              </div>
            </div>
          ) : <p className="note">Seed or select an applicant to view verification results.</p>}
        </div>

        <form className="panel" onSubmit={uploadDocument}>
          <h2>Ingest document</h2>
          <p className="note">Upload a PDF/image or provide a source label. The server stores the blob hash and creates a new immutable forensic check run.</p>
          <div className="grid cols-2">
            <label>Document type<select value={docType} onChange={(e) => setDocType(e.target.value)}><option>IDENTITY</option><option>INCOME</option><option>BANK_STATEMENT</option><option>ADDRESS</option><option>OTHER</option></select></label>
            <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}><option value="upload">Upload</option><option value="AA">Account Aggregator</option><option value="DigiLocker">DigiLocker</option></select></label>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            <span className="note">Document file</span>
            <div style={{ border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: 18, marginTop: 6, textAlign: 'center' }}>
              <UploadCloud size={24} style={{ color: COLORS.green }} />
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'block', margin: '10px auto 0' }} />
              {file && <span className="note">{file.name}</span>}
            </div>
          </label>
          <button className="btn" type="submit" disabled={!file || !selectedId || loading} style={{ marginTop: 14 }}><FileUp size={15} /> {loading ? 'Verifying…' : 'Ingest & Verify'}</button>
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
            <h2>Documents</h2>
            <table><thead><tr><th>Type</th><th>Source</th><th>MIME</th><th>Hash</th><th>Verified</th></tr></thead><tbody>
              {(result.documents || []).map((d) => <tr key={d.doc_id}><td>{d.doc_type}</td><td>{d.source}</td><td>{d.mime}</td><td className="mono">{d.hash?.slice(0, 18)}…</td><td>{d.verified ? <CheckCircle2 size={16} style={{ color: COLORS.green }} /> : <XCircle size={16} style={{ color: COLORS.red }} />}</td></tr>)}
            </tbody></table>
          </div>
        </>
      )}
    </div>
  )
}

function DatabaseIcon() { return <FileCheck2 size={15} /> }
