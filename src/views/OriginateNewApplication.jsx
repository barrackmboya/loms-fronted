import { useState, useEffect, useCallback } from 'react'
import { FilePlus2, Gavel } from 'lucide-react'
import { api, authHeaders } from '../lib/api'
import { DOC_SLOTS, DEMO_EXTRACTION, validateSlot } from './OriginateApplication'
import OriginateApplication from './OriginateApplication'
import OriginateDecisioning from './OriginateDecisioning'
import { Dialog } from '../components'

// Moved here from Originate.jsx: the whole "New application" container — its
// constants, state, decide/book flows and page switch — wrapped in a shared
// Dialog so every channel tab can offer "New Application" without duplicating
// the form. Props: onClose (dismiss the dialog), onDecided (tell the table to
// refetch once a decision/book lands), userProfile (module access gate).
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
  name: '', product_name: 'PERSONAL_LOAN', product: 'UNSECURED', collateral_value: 0,
  amount_requested: 250000, tenure_months: 24,
  stated_income: 95000, verified_income: 95000, existing_debt_service: 9000,
  bureau_score: 690, bureau_enquiries_6m: 2, delinquencies_12m: 0, bounces_6m: 0,
  doc_source: 'UPLOAD', device_apps_24h: 1, tamper_score: 0.08, salary_domiciled: false,
  ip_geo_mismatch: false,
  kyc_status: 'PENDING', sanctions_hit: true, phone_verified: false,
  party_id: null, party_type: 'IND', sme_evidence: SME_BLANK_EVIDENCE,
}

const BLANK_DOC_SLOTS = () =>
  Object.fromEntries(DOC_SLOTS.map((s) => [s.key, { file: null, idType: 'National ID', incomeType: 'M-Pesa statement', password: '', error: null }]))

export default function OriginateNewApplication({ onClose, onDecided, userProfile }) {
  const [form, setForm] = useState(BLANK)
  const [result, setResult] = useState(null)
  const [appId, setAppId] = useState(null)
  const [booked, setBooked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)
  const [page, setPage] = useState('application')
  const [existing, setExisting] = useState(false)
  const [parties, setParties] = useState([])
  const [partySearch, setPartySearch] = useState('')
  const [docSlots, setDocSlots] = useState(BLANK_DOC_SLOTS())
  const [docBusy, setDocBusy] = useState(false)
  const [income, setIncome] = useState(null)
  const [kyc, setKyc] = useState(null)
  const [identityDoc, setIdentityDoc] = useState(null)
  const [crb, setCrb] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const resetForm = () => setForm((f) => ({ ...f, ...BLANK, party_id: null }))
  const setSlot = (key, patch) =>
    setDocSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  const hasAccess = userProfile?.accessible_modules?.includes('origination') ?? false

  const loadParties = useCallback(async (search) => {
    try { setParties(await api.parties(search)) } catch { setParties([]) }
  }, [])

  useEffect(() => { if (existing) loadParties(partySearch) }, [existing, partySearch, loadParties])

  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true)
      if (!hasAccess) {
        setMetrics(null); setMetricsError('Access denied: You do not have permission to view origination metrics'); return
      }
      setMetrics(await api.originationMetrics()); setMetricsError(null)
    } catch (e) {
      setMetricsError(`Failed to load metrics: ${e.message}`); setMetrics(null)
    } finally { setMetricsLoading(false) }
  }, [hasAccess])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  const decide = async () => {
    if (!hasAccess) {
      setError('Access denied: You do not have permission to perform origination actions'); return
    }
    setBusy(true); setBooked(null); setError(null)
    setProgress(0); setProgressMessage('Starting decision…')
    try {
      if (existing && !form.party_id) {
        setError('Select a customer before running the decision.')
        setBusy(false); setProgress(0); setProgressMessage(''); return
      }
      const attached = DOC_SLOTS.filter((s) => docSlots[s.key].file)
      for (const s of attached) {
        const err = validateSlot(s, docSlots[s.key])
        if (err) { setSlot(s.key, { error: err }); setBusy(false); setProgress(0); setProgressMessage(''); return }
      }
      if (attached.length && !existing) {
        setForm((f) => ({ ...f, ...Object.assign({}, ...attached.map((s) => DEMO_EXTRACTION[s.key])) }))
      }
      const org = form.party_type === 'ORG'
      const { kyc_status, sanctions_hit, phone_verified,
              name, party_id, party_type, sme_evidence, ...rest } = form
      const payload = org
        ? (existing
            ? { party_id, party_type, sme_evidence, ...rest }
            : { kyc_status, sanctions_hit, phone_verified, name, party_type, sme_evidence, ...rest })
        : (existing
            ? { ...rest, party_id }
            : { kyc_status, sanctions_hit, phone_verified, name, ...rest })
      setProgress(12); setProgressMessage('Creating application…')
      const app = await api.createApplication(payload)
      setAppId(app.application_id)
      const slotWork = 60
      let done = 12
      if (attached.length) {
        setDocBusy(true)
        const uploadWork = Math.floor(slotWork / 2)
        const analyzeWork = slotWork - uploadWork
        setProgressMessage('Uploading documents…')
        const bodyFor = (s) => {
          const body = new FormData()
          body.append('app_id', app.application_id)
          body.append('doc_type', s.key)
          const typePick = s.idTypeField ? docSlots[s.key].idType : (s.types ? docSlots[s.key].incomeType : null)
          body.append('source', typePick ? `${typePick} (upload)` : 'upload')
          body.append('file', docSlots[s.key].file)
          if (s.key === 'INCOME' && docSlots[s.key].password) body.append('password', docSlots[s.key].password)
          return body
        }
        await Promise.allSettled(attached.map(async (s) => {
          await fetch('/api/document-verification/documents/', { method: 'POST', body: bodyFor(s) })
          done = Math.min(12 + uploadWork, done + Math.floor(uploadWork / 3))
          setProgress(done)
        }))
        const analysisBody = new FormData()
        if (docSlots.INCOME?.file && /\.(xlsx?|pdf)$/i.test(docSlots.INCOME.file.name)) {
          analysisBody.append('income', docSlots.INCOME.file)
          if (docSlots.INCOME.password) analysisBody.append('income_password', docSlots.INCOME.password)
        }
        if (docSlots.IDENTITY?.file) {
          analysisBody.append('identity', docSlots.IDENTITY.file)
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
                if (r.status !== 'ok') continue
                if (r.kind === 'income') setIncome(r.result)
                else if (r.kind === 'kra_pin') setKyc(r.result)
                else if (r.kind === 'identity') setIdentityDoc(r.result)
                else if (r.kind === 'crb') {
                  setCrb(r.result)
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
      setPage('decision')
      onDecided?.()
    } catch (e) { setError(e.message) } finally { setBusy(false); setDocBusy(false); setProgress(0); setProgressMessage('') }
  }

  const book = async () => {
    if (!hasAccess) {
      setError('Access denied: You do not have permission to perform origination actions'); return
    }
    setBusy(true)
    try {
      setBooked(await api.book(appId)); onDecided?.()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const startNewApplication = () => {
    setResult(null); setAppId(null); setBooked(null); setError(null)
    setIncome(null); setKyc(null); setCrb(null); setIdentityDoc(null)
    resetForm(); setExisting(false); setDocSlots(BLANK_DOC_SLOTS()); setPage('application')
  }

  // While a decision run is in flight the close button is a no-op: in-flight
  // uploads / the decision call must not be orphaned by an accidental dismiss.
  return (
    <Dialog title="New application" subtitle="Stated and verified income stay separate — the scorecard reads only the verified figure."
      width={900} onClose={busy ? undefined : onClose}>
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
    </Dialog>
  )
}
