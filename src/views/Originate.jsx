import { useState, useEffect, useCallback } from 'react'
import { FilePlus2, Gavel } from 'lucide-react'
import { api, authHeaders } from '../lib/api'
import { DOC_SLOTS, DEMO_EXTRACTION, validateSlot } from './OriginateApplication'
import OriginateApplication from './OriginateApplication'
import OriginateDecisioning from './OriginateDecisioning'

// Container for the origination module: owns the application form state and the
// decide/book flows, and switches between two pages — "New application"
// (OriginateApplication.jsx, always visible) and "Decision record"
// (OriginateDecisioning.jsx, appears — sliding in — once a decision has been
// run, and offers a fresh "New application" action).
// Mirrors ApplicationCreateSerializer (apps/origination/serializers.py): every
// underwriting input the backend reads is represented here — including KYC
// evidence, stated vs verified income, and product/collateral. KYC evidence has
// no defaults (Phase 4): a NEW applicant states the facts (form opens
// conservative); a RETURNING applicant is picked by party_id and the backend
// reuses their stored KYC evidence. Face match, liveness and address tenure are
// pipeline facts (eKYC / document service), not operator inputs. A BUSINESS (ORG)
// applicant states the sheet-13 SME evidence groups instead of the consumer KYC
// block; the backend scores the business card (hybrid: SME tier drives the offer,
// the logistic PD stays at G6).
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
  product_name: 'PERSONAL_LOAN',
  product: 'UNSECURED', collateral_value: 0,
  amount_requested: 250000, tenure_months: 24,
  stated_income: 95000, verified_income: 95000, existing_debt_service: 9000,
  bureau_score: 690, bureau_enquiries_6m: 2, delinquencies_12m: 0, bounces_6m: 0,
  doc_source: 'UPLOAD', device_apps_24h: 1, tamper_score: 0.08, salary_domiciled: false,
  ip_geo_mismatch: false,
  kyc_status: 'PENDING', sanctions_hit: true,
  phone_verified: false,
  party_id: null, party_type: 'IND',
  sme_evidence: SME_BLANK_EVIDENCE,
}

const BLANK_DOC_SLOTS = () =>
  Object.fromEntries(DOC_SLOTS.map((s) => [s.key, { file: null, idType: 'National ID', incomeType: 'M-Pesa statement', password: '', error: null }]))

// The document slots' ingest + analysis no longer walks them one at a time:
// uploads go out concurrently and the batch analyze endpoint extracts all
// kinds on the backend at once, so no per-slot progress labels are needed.

export default function Originate({ onBooked, userProfile }) {
  const [form, setForm] = useState(BLANK)
  const [result, setResult] = useState(null)
  const [appId, setAppId] = useState(null)
  const [booked, setBooked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Interactive loader state for the "Run decision" flow: percentage progress
  // and the document currently being analysed.
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)
  // Which page of the module is showing: the application form or the decision record
  const [page, setPage] = useState('application')
  // applicant source: pick an existing customer or state a new one's evidence
  const [existing, setExisting] = useState(false)
  const [parties, setParties] = useState([])
  const [partySearch, setPartySearch] = useState('')
  // Document upload slots (panel copied from DocumentVerification.jsx): one
  // {file, idType, incomeType, error} per catalogue entry, ingested on submit.
  const [docSlots, setDocSlots] = useState(BLANK_DOC_SLOTS)
  const [docBusy, setDocBusy] = useState(false)
  // M-Pesa statement income analysis (POST /api/applications/{id}/income-analysis):
  // fetched for the INCOME slot's uploaded statement once the application exists, so
  // the decision record shows statement-derived income features next to the decision.
  const [income, setIncome] = useState(null)
  // KRA PIN certificate extraction (POST /api/applications/{id}/kra-pin): fetched for
  // the IDENTITY slot's uploaded certificate (or OTHER when the ID slot holds an
  // image ID), so the decision record shows the certificate's PIN/name/address facts.
  const [kyc, setKyc] = useState(null)
  // Identity document analysis (POST /api/applications/{id}/identity-document):
  // fetched for the IDENTITY slot's uploaded ID (image or PDF), so the decision
  // record shows the ID's holder facts.
  const [identityDoc, setIdentityDoc] = useState(null)
  // CRB report extraction (POST /api/applications/{id}/crb-report): fetched for the
  // BUREAU_REPORT slot's uploaded report, so the decision record shows the real
  // Metro-Score / enquiries / bounced-cheques facts instead of the demo values.
  const [crb, setCrb] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const resetForm = () => setForm((f) => ({ ...f, ...BLANK, party_id: null }))
  const setSlot = (key, patch) =>
    setDocSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
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
    setProgress(0); setProgressMessage('Starting decision…')
    try {
      if (existing && !form.party_id) {
        setError('Select a customer before running the decision.')
        setBusy(false); setProgress(0); setProgressMessage('')
        return
      }
      // Document extraction (demo): the uploaded documents populate the KYC,
      // income/affordability and bureau/device fields — the operator never keys
      // them. Until the real pipeline is wired, each attached slot contributes
      // its DEMO_EXTRACTION values; a returning customer keeps their stored facts.
      const attached = DOC_SLOTS.filter((s) => docSlots[s.key].file)
      for (const s of attached) {
        const err = validateSlot(s, docSlots[s.key])
        if (err) { setSlot(s.key, { error: err }); setBusy(false); setProgress(0); setProgressMessage(''); return }
      }
      if (attached.length && !existing) {
        setForm((f) => ({ ...f, ...Object.assign({}, ...attached.map((s) => DEMO_EXTRACTION[s.key])) }))
      }
      const org = form.party_type === 'ORG'
      // The backend takes either party_id (KYC evidence reused) or the KYC statement
      // — never both. party_id is destructured out so a new-applicant submit never
      // posts the blank form's null (the backend would refuse it). Every KYC,
      // income and bureau fact came from the uploaded documents (demo-extracted),
      // not from operator keying.
      // Segment-consistent payloads: an ORG file carries the SME evidence groups
      // (and the party_type the backend mirrors onto the Party row), an IND file
      // carries the consumer KYC block — never both.
      const { kyc_status, sanctions_hit, phone_verified,
              name, party_id, party_type, sme_evidence, ...rest } = form
      const payload = org
        ? (existing
            ? { party_id, party_type, sme_evidence, ...rest }
            : { kyc_status, sanctions_hit, phone_verified,
                name, party_type, sme_evidence, ...rest })
        : (existing
            ? { ...rest, party_id }
            : { kyc_status, sanctions_hit, phone_verified, name, ...rest })
      setProgress(12); setProgressMessage('Creating application…')
      const app = await api.createApplication(payload)
      setAppId(app.application_id)
      // Ingest the attached documents against the saved application, then decide.
      // Progress is split across the fixed bookends (create + decide) and the two
      // concurrent phases (parallel uploads, then the batch extraction call) so the
      // percentage moves forward as the documents are analysed. A local counter is
      // used (rather than React state) because state updates don't take effect
      // within the same loop.
      const slotWork = 60   // percent shared across the upload + extraction phases
      let done = 12
      if (attached.length) {
        setDocBusy(true)
        const uploadWork = Math.floor(slotWork / 2)
        const analyzeWork = slotWork - uploadWork
        // Phase 1 — ingest every slot's file against the application, all at once.
        // An ingest failure is isolated to its own slot (allSettled) and never
        // blocks the decision run.
        setProgressMessage('Uploading documents…')
        const bodyFor = (s) => {
          const body = new FormData()
          body.append('app_id', app.application_id)
          body.append('doc_type', s.key)
          const typePick = s.idTypeField ? docSlots[s.key].idType : (s.types ? docSlots[s.key].incomeType : null)
          body.append('source', typePick ? `${typePick} (upload)` : 'upload')
          body.append('file', docSlots[s.key].file)
          // Encrypted M-Pesa statement PDFs need the password (usually the
          // account holder's ID number); xlsx needs none.
          if (s.key === 'INCOME' && docSlots[s.key].password)
            body.append('password', docSlots[s.key].password)
          return body
        }
        await Promise.allSettled(attached.map(async (s) => {
          await fetch('/api/document-verification/documents/', { method: 'POST', body: bodyFor(s) })
          // Nudge the bar once per completed upload (a third of the phase).
          done = Math.min(12 + uploadWork, done + Math.floor(uploadWork / 3))
          setProgress(done)
        }))
        // Phase 2 — analysis. One batch call runs every attached document's
        // extraction concurrently on the backend (doc_pipeline's thread pool),
        // replacing the sequential per-slot round-trips. Each kind's result lands
        // in its own panel state; a failed/timeout kind just leaves its panel
        // empty and never blocks the decision run.
        const analysisBody = new FormData()
        if (docSlots.INCOME?.file && /\.(xlsx?|pdf)$/i.test(docSlots.INCOME.file.name)) {
          analysisBody.append('income', docSlots.INCOME.file)
          if (docSlots.INCOME.password) analysisBody.append('income_password', docSlots.INCOME.password)
        }
        if (docSlots.IDENTITY?.file) {
          analysisBody.append('identity', docSlots.IDENTITY.file)
          // A PDF in the IDENTITY slot is also treated as the KRA PIN certificate.
          if (/\.pdf$/i.test(docSlots.IDENTITY.file.name)) analysisBody.append('kra_pin', docSlots.IDENTITY.file)
        }
        if (docSlots.BUREAU_REPORT?.file && /\.pdf$/i.test(docSlots.BUREAU_REPORT.file.name)) {
          analysisBody.append('crb', docSlots.BUREAU_REPORT.file)
        }
        setProgress(12 + uploadWork)
        setProgressMessage('Analyzing documents…')
        try {
          if ([...analysisBody.keys()].length) {
            const batchRes = await fetch(`/api/applications/${app.application_id}/documents/analyze`, {
              method: 'POST', headers: authHeaders(), body: analysisBody,
            })
            if (batchRes.ok) {
              const batch = await batchRes.json()
              for (const r of batch.results || []) {
                if (r.status !== 'ok') continue   // panel simply shows no extraction for this kind
                if (r.kind === 'income') setIncome(r.result)
                else if (r.kind === 'kra_pin') setKyc(r.result)
                else if (r.kind === 'identity') setIdentityDoc(r.result)
                else if (r.kind === 'crb') {
                  setCrb(r.result)
                  // The extracted bureau fields replace the demo values in the form.
                  if (r.result.fields) setForm((f) => ({ ...f, ...r.result.fields }))
                }
              }
            }
          }
        } catch { /* analysis failures don't block the decision run */ }
        done = Math.min(100, 12 + uploadWork + analyzeWork)
        setProgress(done)
        setDocBusy(false)
      }
      setProgress(Math.max(done, 80)); setProgressMessage('Finalising decision…')
      setResult(await api.decide(app.application_id))
      setProgress(100); setProgressMessage('Decision complete')
      // The decision record page slides in as soon as the decision exists.
      setPage('decision')
      loadMetrics()
    } catch (e) { setError(e.message) } finally { setBusy(false); setDocBusy(false); setProgress(0); setProgressMessage('') }
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

  // "New application" from the decision record page: clear the run (the Decision
  // record tab disappears until the next decision) and open a blank form.
  const startNewApplication = () => {
    setResult(null); setAppId(null); setBooked(null); setError(null)
    setIncome(null); setKyc(null); setCrb(null); setIdentityDoc(null)
    resetForm()
    setExisting(false)
    setDocSlots(BLANK_DOC_SLOTS())
    setPage('application')
  }

  return (
    <div>
      <nav className="subtabs" role="tablist">
        <button role="tab" aria-selected={page === 'application'}
          onClick={() => setPage('application')}>
          <FilePlus2 size={15} /> New application
        </button>
        {result && (
          <button role="tab" aria-selected={page === 'decision'}
            onClick={() => setPage('decision')}>
            <Gavel size={15} /> Decision record
          </button>
        )}
      </nav>

      {page === 'application' ? (
        <OriginateApplication
          form={form} set={set} resetForm={resetForm}
          existing={existing} setExisting={setExisting}
          parties={parties} partySearch={partySearch} setPartySearch={setPartySearch}
          docSlots={docSlots} setSlot={setSlot}
          metrics={metrics} metricsLoading={metricsLoading} metricsError={metricsError}
          busy={busy || docBusy} error={error}
          progress={progress} progressMessage={progressMessage}
          onDecide={decide}
        />
      ) : (
        // Keyed by appId so the slide-in plays again on every new decision.
        <div className="grid slide-in" key={appId}>
          <OriginateDecisioning res={result} form={form} income={income} kyc={kyc} crb={crb} identityDoc={identityDoc}
            onBook={book}
            booked={booked} busy={busy}
            onNewApplication={startNewApplication} />
        </div>
      )}
    </div>
  )
}
