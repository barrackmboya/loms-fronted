import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, authHeaders } from '../../../lib/api'
import { DOC_SLOTS, validateSlot } from '../../../views/OriginateApplication'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import ApplicationForm from './ApplicationForm'

const CHANNEL_DISPLAY = {
  APP: 'Mobile App',
  WEB: 'Web',
  BRANCH: 'Branch',
}

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

export default function NewApplicationDialog({
  open,
  onOpenChange,
  channel = 'APP',
  onCreated,
}) {
  const [form, setForm] = useState(BLANK)
  const [docSlots, setDocSlots] = useState(BLANK_DOC_SLOTS())
  const [existing, setExisting] = useState(false)
  const [parties, setParties] = useState([])
  const [partySearch, setPartySearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Track dirty state: any field different from BLANK, or any document attached
  useEffect(() => {
    const isDirty =
      JSON.stringify(form) !== JSON.stringify(BLANK) ||
      Object.values(docSlots).some((s) => s.file !== null)
    setDirty(isDirty)
  }, [form, docSlots])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const resetForm = () => setForm((f) => ({ ...f, ...BLANK, party_id: null }))
  const setSlot = (key, patch) =>
    setDocSlots((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const loadParties = useCallback(async (search) => {
    try { setParties(await api.parties(search)) } catch { setParties([]) }
  }, [])

  useEffect(() => { if (existing) loadParties(partySearch) }, [existing, partySearch, loadParties])

  const handleSubmit = async () => {
    setError(null)

    // Validate required fields
    if (!existing && !form.name.trim()) {
      setError('Applicant name is required.')
      return
    }
    if (!form.amount_requested || Number(form.amount_requested) <= 0) {
      setError('Amount requested must be greater than zero.')
      return
    }
    if (!form.tenure_months || Number(form.tenure_months) <= 0) {
      setError('Tenure must be greater than zero.')
      return
    }

    // Validate document slots
    const attached = DOC_SLOTS.filter((s) => docSlots[s.key].file)
    for (const s of attached) {
      const err = validateSlot(s, docSlots[s.key])
      if (err) {
        setSlot(s.key, { error: err })
        setError('Please fix document upload errors before submitting.')
        return
      }
      setSlot(s.key, { error: null })
    }

    setBusy(true)
    try {
      // Build payload — same shape as OriginateNewApplication's decide flow,
      // plus the channel field.
      const org = form.party_type === 'ORG'
      const { kyc_status, sanctions_hit, phone_verified, name, party_id, party_type, sme_evidence, ...rest } = form
      const payload = {
        ...rest,
        channel,
        ...(org ? { party_type, sme_evidence } : {}),
        ...(existing ? { party_id } : { kyc_status, sanctions_hit, phone_verified, name }),
      }

      if (attached.length) {
        // Create the application first, then upload documents via multipart.
        const app = await api.createApplication(payload)
        const appId = app.application_id

        await Promise.allSettled(attached.map(async (s) => {
          const body = new FormData()
          body.append('app_id', appId)
          body.append('doc_type', s.key)
          const typePick = s.idTypeField
            ? docSlots[s.key].idType
            : (s.types ? docSlots[s.key].incomeType : null)
          body.append('source', typePick ? `${typePick} (upload)` : 'upload')
          body.append('file', docSlots[s.key].file)
          if (s.key === 'INCOME' && docSlots[s.key].password) {
            body.append('password', docSlots[s.key].password)
          }
          await fetch('/api/document-verification/documents/', {
            method: 'POST',
            headers: authHeaders(),
            body,
          })
        }))
      } else {
        await api.createApplication(payload)
      }

      toast.success('Application created successfully')
      setBusy(false)
      onOpenChange(false)
      onCreated?.()
    } catch (e) {
      setError(e.message)
      toast.error('Failed to create application', { description: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleDialogClose = () => {
    if (!dirty) {
      onOpenChange(false)
      return
    }
    setShowDiscardConfirm(true)
  }

  const handleDiscard = () => {
    setForm(BLANK)
    setDocSlots(BLANK_DOC_SLOTS())
    setExisting(false)
    setPartySearch('')
    setParties([])
    setError(null)
    setShowDiscardConfirm(false)
    onOpenChange(false)
  }

  const channelDisplay = CHANNEL_DISPLAY[channel] || channel

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleDialogClose()
        } else {
          onOpenChange(true)
        }
      }}
    >
      <DialogContent className="max-w-[900px] max-h-[90vh]">
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
          <DialogTitle className="text-sm font-semibold">
            New Application — {channelDisplay}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a new {channelDisplay.toLowerCase()} application
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-4 max-h-[calc(90vh-170px)]">
          <ApplicationForm
            form={form}
            set={set}
            resetForm={resetForm}
            existing={existing}
            setExisting={setExisting}
            parties={parties}
            partySearch={partySearch}
            setPartySearch={setPartySearch}
            docSlots={docSlots}
            setSlot={setSlot}
            error={error}
          />
        </div>

        <DialogFooter className="border-t border-border pt-4 gap-4 sm:flex-row sm:justify-end">
          {showDiscardConfirm ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="btn ghost"
              >
                Keep Editing
              </button>
              <button
                onClick={handleDiscard}
                className="btn destructive"
              >
                Discard
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={handleDialogClose}
                disabled={busy}
                className="btn ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="btn"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
