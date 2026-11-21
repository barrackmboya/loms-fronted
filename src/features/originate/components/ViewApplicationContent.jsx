// View Application panel body — the four detail sections (KYC report header,
// loan, personal + contact, residential + employment) plus the Run Decision
// action. Data is loaded from GET /api/origination/reports/kyc/?id=<id>
// (mapped by mapKycReport via useKycReport); only the chrome (sticky header +
// close) is provided by SlidePanel.jsx.
import { useCallback, useEffect, useState } from 'react'
import {
  FileText, FileSearch, Image as ImageIcon, MapPin, Building2, Home, Hash, Globe, Calendar,
  Banknote, Percent, CircleCheck, User, Users, Mail, Phone, Navigation, Map as MapIcon,
  ZoomIn, ZoomOut, ExternalLink, Briefcase, Wallet, Loader2, AlertCircle, FileX,
  UserCheck, StickyNote, Shield, Gauge, ClipboardCheck, BookOpen, XCircle,
} from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Skeleton } from '../../../components/ui/skeleton'
import { MapPanel } from '../../../components/MapPanel'
import { useKycReport } from '../hooks/useKycReport'
import { api } from '../../../lib/api'
import { toast } from 'sonner'
import { canBook, canRunDecision, statusLabel, statusTone } from '../lib/statuses'

/* ------------------------------ helpers ------------------------------- */
const ICON = 'h-3.5 w-3.5 shrink-0 text-[var(--teal)]'

// Loan status → badge tone is owned by lib/statuses.js; the panel only asks it
// for the label/colour so the list and the detail view cannot drift apart.

function GateChip({ ok, label, detail, icon: Icon }) {
  // Title-case a string (first letter of each word uppercase)
  const titleCase = (str) =>
    String(str)
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

  const capitalizedLabel = titleCase(label)

  // Determine detail color based on content
  const getDetailColor = (detailText) => {
    if (!detailText) return 'text-muted'

    const text = String(detailText).toUpperCase()

    // Empty / not available → red (something is missing)
    if (text === '—' || text === 'N/A') return 'text-destructive'

    // Green (success) indicators
    if (text.includes('VERIFIED') ||
        text.includes('CLEAR') ||
        text.includes('ACCEPTED') ||
        text.includes('PASS') ||
        text === 'YES') {
      return 'text-success'
    }

    // Red (destructive) indicators
    if (text.includes('FAILED') ||
        text.includes('REJECTED') ||
        text.includes('BLOCK') ||
        text.includes('DECLINE') ||
        text === 'NO') {
      return 'text-destructive'
    }

    // Amber (warning) indicators
    if (text.includes('PENDING') ||
        text.includes('REVIEW') ||
        text.includes('EDD') ||
        text.includes('CONDITIONAL') ||
        text.includes('PARTIAL')) {
      return 'text-warning'
    }

    // For bureau scores, color based on value
    const score = Number(detailText)
    if (Number.isFinite(score)) {
      if (score >= 650) return 'text-success'
      if (score >= 550) return 'text-warning'
      return 'text-destructive'
    }

    // For verified income (currency amounts), green if present and > 0
    if (detailText.includes('KES') || detailText.includes('KSH') || detailText.includes('Ksh')) {
      const amount = Number(detailText.replace(/[^\d]/g, ''))
      if (Number.isFinite(amount) && amount > 0) return 'text-success'
      // Ksh 0 → red (no income verified)
      return 'text-destructive'
    }

    return 'text-muted'
  }

  const detailColor = getDetailColor(detail)

  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 ${
        ok ? 'border-success/30 bg-success/5' : 'border-warning/40 bg-warning/5'
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-success' : 'text-warning'}`} />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground">{capitalizedLabel}</p>
        {detail && (
          <p className={`text-[11px] font-semibold uppercase tracking-tight ${detailColor}`}>
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

function Card({ className = '', children }) {
  return (
    <section className={`rounded-md border border-border bg-white p-5 ${className}`}>{children}</section>
  )
}

function SectionTitle({ n, icon: Icon, children }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-[11px] font-bold text-white">
        {n ?? <Icon className="h-3.5 w-3.5" />}
      </span>
      <h3 className="font-sans text-[14px] font-semibold uppercase tracking-[0.04em] text-foreground">{children}</h3>
    </div>
  )
}

const SubTitle = ({ children, className = '' }) => (
  <h4 className={`mb-3 font-sans text-[14px] font-semibold text-foreground ${className}`}>{children}</h4>
)

// Inline "icon Label: value" row, as in the report
function Field({ icon: Icon, label, children, mono = false }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-[13px] leading-5">
      <Icon className={`${ICON} mt-[3px]`} />
      <div className={`min-w-0 break-words text-foreground ${mono ? 'font-mono' : ''}`}>
        <span className="font-semibold text-[var(--teal)]">{label}:</span>{' '}
        {children}
      </div>
    </div>
  )
}

const Divider = () => <hr className="my-4 border-border" />

const debtLabel = (row) => row?.label || row?.type || row?.name || row?.facility || 'Debt'
const debtAmount = (row) => {
  const n = Number(row?.amount ?? row?.monthly_payment ?? row?.value)
  return Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 0 }) : '—'
}

/* ------------------------- loading / error states --------------------- */
function PanelSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-56 w-full" />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium text-destructive">Failed To Load Application Details</p>
      <p className="text-[13px] text-muted">{error?.message || 'Something went wrong.'}</p>
      <button onClick={onRetry} className="btn">
        <Loader2 className="h-4 w-4 mr-2" />
        Retry
      </button>
    </div>
  )
}

/* ------------------------- application documents ---------------------- */
function DocIcon({ kind }) {
  return kind === 'image'
    ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    : <FileText className="h-4 w-4 shrink-0 text-destructive" />
}

// Loads a document through api.fetchObjectUrl (blob → object URL). Blob URLs
// are not subject to X-Frame-Options, so PDFs render in an <iframe> even when
// the media response carries frame-deny headers; the authenticated fetch also
// keeps working if media ever gets auth-protected.
function useDocumentObjectUrl(url) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [status, setStatus] = useState(url ? 'loading' : 'unavailable')

  useEffect(() => {
    if (!url) {
      setObjectUrl(null)
      setStatus('unavailable')
      return undefined
    }
    let revoke = null
    let cancelled = false
    setStatus('loading')
    api.fetchObjectUrl(url).then((objUrl) => {
      if (cancelled) {
        if (objUrl) URL.revokeObjectURL(objUrl)
        return
      }
      revoke = objUrl
      setObjectUrl(objUrl)
      setStatus(objUrl ? 'ready' : 'failed')
    })
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [url])

  return { objectUrl, status }
}

function DocumentPreview({ doc }) {
  const { objectUrl, status } = useDocumentObjectUrl(doc.url)

  if (status === 'loading') {
    return (
      <div className="flex h-[480px] flex-col items-center justify-center gap-2 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-[12px]">Loading {doc.name}…</span>
      </div>
    )
  }

  // Render the real file (image inline, PDF via the browser viewer); fall back
  // to a placeholder when the file has no URL or fails to load.
  if (objectUrl && doc.kind === 'image') {
    return <img src={objectUrl} alt={doc.name} className="w-full" />
  }
  if (objectUrl && doc.kind === 'pdf') {
    return (
      <iframe
        src={objectUrl}
        title={doc.name}
        className="h-[480px] w-full border-0"
      />
    )
  }
  return (
    <div className="flex h-[480px] flex-col items-center justify-center gap-2 text-muted">
      <DocIcon kind={doc.kind} />
      <span className="text-[12px]">
        {status === 'failed' ? `${doc.name} could not be loaded.` : `${doc.name} — preview not available`}
      </span>
      {doc.url && (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--teal)] hover:underline">
          Open in a new tab
        </a>
      )}
    </div>
  )
}

function DocumentsViewer({ docs }) {
  // Default to the payslip (the KYC income document), else the first file.
  const [activeId, setActiveId] = useState('payslip')
  const [zoom, setZoom] = useState(100)
  const active = docs.find((d) => d.id === activeId) ?? docs.find((d) => d.id === 'payslip') ?? docs[0]
  const clamp = (v) => Math.min(200, Math.max(50, v))

  if (!docs.length || !active) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-muted">
        <FileX className="h-6 w-6" />
        <p className="text-[13px]">No Documents Uploaded For This Application.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h4 className="font-sans text-[14px] font-semibold text-foreground">Application Documents</h4>
        <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] text-muted">{docs.length} files</span>
      </div>

      <div className="grid grid-cols-[170px_1fr] sm:grid-cols-[200px_1fr]">
        {/* list */}
        <div className="border-r border-border bg-accent/40">
          <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.04em] text-muted">Documents</p>
          <ul>
            {docs.map((d) => {
              const on = d.id === active.id
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => { setActiveId(d.id); setZoom(100) }}
                    className={`flex w-full items-center gap-2 border-l-2 px-3 py-3 text-left transition-colors duration-150 ${
                      on ? 'border-[var(--teal)] bg-background' : 'border-transparent hover:bg-accent'
                    }`}
                  >
                    <DocIcon kind={d.kind} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-foreground">{d.name}</span>
                      <span className="block text-[11px] text-[var(--teal)]">Uploaded</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* preview */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-sans text-[14px] font-semibold text-foreground">{active.name}</span>
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-[var(--teal)] hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Original
            </a>
          </div>
          <div className="flex items-center justify-center gap-4 border-b border-border bg-accent/40 py-2 text-[13px] text-foreground">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => clamp(z - 25))}><ZoomOut className="h-4 w-4" /></button>
            <span className="w-12 text-center font-mono">{zoom}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => clamp(z + 25))}><ZoomIn className="h-4 w-4" /></button>
          </div>
          <div className="h-[460px] overflow-auto bg-accent/40 p-4">
            <div
              className="mx-auto origin-top rounded-sm border border-border bg-white p-6 transition-transform duration-150"
              style={{ transform: `scale(${zoom / 100})`, width: '100%', minHeight: 520 }}
            >
              <DocumentPreview doc={active} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- panel body ----------------------------- */
export function ViewApplicationContent({ applicationId }) {
  const { report, loading, error, reload } = useKycReport(applicationId)
  const [decisionRunning, setDecisionRunning] = useState(false)
  const [booking, setBooking] = useState(false)
  // Latest persisted M-Pesa ExtractionRun, so the FCF values are visible in
  // the application panel (and after a decision run) without re-uploading.
  const [incomeAnalysis, setIncomeAnalysis] = useState(null)

  const loadIncomeAnalysis = useCallback(async () => {
    if (!applicationId) return
    try {
      const data = await api.incomeAnalysis(applicationId)
      const payload = data?.income_analysis ?? (data?.derived_features ? data : null)
      setIncomeAnalysis(payload)
    } catch {
      // Keep whatever the decision response already returned (e.g. an
      // origination-only operator may not have decisioning module access).
    }
  }, [applicationId])

  useEffect(() => { loadIncomeAnalysis() }, [loadIncomeAnalysis])

  const handleRunDecision = async () => {
    if (decisionRunning) return
    setDecisionRunning(true)
    try {
      // The backend completes extraction for any documents without an
      // ExtractionRun before scoring, then returns the income analysis block.
      const response = await api.decide(applicationId)
      setIncomeAnalysis((prev) => response?.income_analysis ?? prev)
      toast.success('Decision completed successfully.')
      await Promise.all([reload(), loadIncomeAnalysis()])
    } catch (e) {
      toast.error('Decision failed.', { description: e.message })
    } finally {
      setDecisionRunning(false)
    }
  }

  const handleBook = async () => {
    if (booking) return
    setBooking(true)
    try {
      await api.book(applicationId)
      toast.success('Application booked.')
      reload()
    } catch (e) {
      toast.error('Booking failed.', { description: e.message })
    } finally {
      setBooking(false)
    }
  }

  if (loading) return <PanelSkeleton />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!report) return null

  const {
    customer,
    report: meta,
    loan,
    lifecycle,
    declarations,
    personal: p,
    documents,
    contact: c,
    residential,
    employment: e,
  } = report

  const decide = canRunDecision(lifecycle.statusRaw)
  const book = canBook(lifecycle.statusRaw)

  return (
    <div>
      {/* Body scrolls inside the slide panel (SlidePanel body, overflow-y-auto).
         This stays out of the way — no nested scroller here. */}
      <div className="space-y-4 bg-accent/40">
        {/* Report header */}
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--teal)] text-white">
                <FileSearch className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-sans text-[20px] font-bold leading-tight text-foreground">{meta.title}</h2>
                <p className="text-[13px] text-[var(--teal)]">Customer: {customer}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4 md:divide-x md:divide-border">
              {[
                ['Reference Number', meta.reference, true],
                ['Organization', meta.organization],
                ['Generated At', meta.generatedAt],
                ['Generated By', meta.generatedBy],
              ].map(([k, v, mono], i) => (
                <div key={k} className={i ? 'md:pl-6' : ''}>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--teal)]">{k}</dt>
                  <dd className={`text-[13px] text-foreground ${mono ? 'font-mono' : ''}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        {/* Loan application details */}
        <Card>
          <SectionTitle icon={FileText}>Loan Application Details</SectionTitle>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
            <Field icon={Briefcase} label="Loan Product">{loan.product}</Field>
            <Field icon={Briefcase} label="Product Type">{loan.productType}</Field>
            <Field icon={Globe} label="Currency">{loan.currency}</Field>
            <Field icon={Banknote} label="Loan Amount" mono>{loan.amount}</Field>
            <Field icon={Calendar} label="Loan Term">{loan.term}</Field>
            <Field icon={Wallet} label="Monthly Payment" mono>{loan.monthly}</Field>
            <Field icon={Percent} label="Interest Rate">{loan.interest}</Field>
            <Field icon={Banknote} label="Processing Fee">{loan.fee}</Field>
            <Field icon={Percent} label="Cost Of Credit">{loan.cost}</Field>
            <Field icon={CircleCheck} label="Status">
              <Badge variant={statusTone(lifecycle.statusRaw)} className="align-middle text-xs">
                {statusLabel(lifecycle.statusRaw)}
              </Badge>
            </Field>
            <Field icon={Calendar} label="Submitted">{loan.submitted}</Field>
            <Field icon={Calendar} label="Last Updated">{loan.updated}</Field>
          </div>
        </Card>

        {/* Lifecycle gates + declarations (ORG-02, ORG-03, DEC-01) */}
        <Card>
          <SectionTitle icon={ClipboardCheck}>Lifecycle &amp; Gate Evidence</SectionTitle>

          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-4">
            <Field icon={Hash} label="Reference" mono>{lifecycle.reference}</Field>
            <Field icon={Briefcase} label="Product Class">{lifecycle.productClass}</Field>
            <Field icon={Users} label="Segment">{lifecycle.segment}</Field>
            <Field icon={Calendar} label="Decision Date">{lifecycle.decisionAt}</Field>
          </div>

          <Divider />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <GateChip
              ok={lifecycle.gates.kyc}
              label="KYC + sanctions"
              detail={`${lifecycle.kycStatus} · ${lifecycle.sanctionsStatus}`}
              icon={UserCheck}
            />
            <GateChip
              ok={lifecycle.gates.documents}
              label="Document pack"
              detail={lifecycle.packStatus}
              icon={StickyNote}
            />
            <GateChip
              ok={lifecycle.gates.fraud}
              label="Fraud screening"
              detail={lifecycle.fraudDecision}
              icon={Shield}
            />
            <GateChip
              ok={lifecycle.gates.income}
              label="Verified income"
              detail={lifecycle.verifiedIncome}
              icon={Banknote}
            />
            <GateChip
              ok={lifecycle.gates.bureau}
              label="Bureau score"
              detail={lifecycle.bureauScore}
              icon={Gauge}
            />
          </div>

          {lifecycle.missingDocuments.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 text-[12px] text-foreground">
                <span className="font-semibold">Missing Documents:</span>{' '}
                {lifecycle.missingDocuments.join(', ')}
              </div>
            </div>
          )}

          <Divider />

          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-4">
            <Field icon={Banknote} label="Verified Income" mono>{lifecycle.verifiedIncome}</Field>
            <Field icon={Percent} label="Bureau Score" mono>{lifecycle.bureauScore}</Field>
            <Field icon={Banknote} label="Collateral Value" mono>{lifecycle.collateralValue}</Field>
            <Field icon={ClipboardCheck} label="Conditions">{lifecycle.conditionsStatus}</Field>
          </div>

          <Divider />
          <SubTitle>Declarations</SubTitle>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-5">
            <Field icon={Wallet} label="Monthly Expenses" mono>{declarations.monthlyExpenses}</Field>
            <Field icon={Users} label="Dependents" mono>{declarations.dependents}</Field>
            <Field icon={Home} label="Rent / Housing" mono>{declarations.rentOrHousing}</Field>
            <Field icon={Banknote} label="Other Income" mono>{declarations.otherIncome}</Field>
            <Field icon={Wallet} label="Existing Debt Service" mono>{declarations.existingDebtService}</Field>
          </div>
          {declarations.existingDebtBreakdown.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--teal)]">Existing Debt Breakdown</p>
              <ul className="mt-1 grid grid-cols-1 gap-1 text-[13px] text-foreground sm:grid-cols-2">
                {declarations.existingDebtBreakdown.map((row, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 rounded border border-border px-3 py-1.5">
                    <span className="truncate">{debtLabel(row)}</span>
                    <span className="font-mono tabular-nums">{debtAmount(row)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incomeAnalysis && (
            <>
              <Divider />
              <SubTitle>M-Pesa Income Analysis (FCF)</SubTitle>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Monthly FCF', incomeAnalysis.derived_features?.monthly_fcf],
                  ['Discounted FCF', incomeAnalysis.derived_features?.discounted_fcf],
                  ['Annual FCF', incomeAnalysis.derived_features?.annual_fcf],
                  ['Avg Daily FCF', incomeAnalysis.derived_features?.avg_daily_fcf],
                  ['Adjusted Daily FCF', incomeAnalysis.derived_features?.adjusted_daily_fcf],
                  ['Stable FCF', incomeAnalysis.derived_features?.stable_fcf],
                ].map(([label, feature]) => (
                  <Field key={label} icon={Banknote} label={label} mono>
                    {feature?.value != null
                      ? Number(feature.value).toLocaleString('en-KE', { maximumFractionDigits: 2 })
                      : '—'}
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Verified monthly income (FCF proxy): {incomeAnalysis.income_summary?.verified_income_monthly != null
                  ? Number(incomeAnalysis.income_summary.verified_income_monthly).toLocaleString('en-KE', { maximumFractionDigits: 2 })
                  : '—'}
                {' · '}statement as of {incomeAnalysis.reference_date || '—'}
              </p>
            </>
          )}
        </Card>

        {/* Row: Personal | Contact */}
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
          {/* 1. PERSONAL DETAILS */}
          <Card>
            <SectionTitle n={1}>Personal Details</SectionTitle>

            <div className="mb-5 flex flex-col items-center gap-1">
              <div className="flex h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-sm border-2 border-[var(--teal)]/30 bg-accent">
                {p.photo
                  ? <img src={p.photo} alt="Passport Photo" className="h-full w-full object-cover" />
                  : <User className="h-14 w-14 text-muted-foreground" />}
              </div>
              <p className="text-[11px] text-[var(--teal)]">Passport Photo</p>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field icon={User} label="First Name">{p.firstName}</Field>
              <Field icon={User} label="Surname">{p.surname}</Field>
              <Field icon={User} label="Other Names">{p.otherNames}</Field>
              <Field icon={Hash} label="ID Number" mono>{p.idNumber}</Field>
              <Field icon={Calendar} label="Date Of Birth">{p.dob}</Field>
              <Field icon={User} label="Gender">{p.gender}</Field>
              <Field icon={User} label="Marital Status">{p.marital}</Field>
              <Field icon={Users} label="Aliases">{p.aliases}</Field>
              <Field icon={CircleCheck} label="Verified">{p.verified}</Field>
            </div>

            <Divider />
            <DocumentsViewer docs={documents} />
          </Card>

          {/* 2. CONTACT INFORMATION */}
          <Card>
            <SectionTitle n={2}>Contact Information</SectionTitle>

            <SubTitle>Primary Contacts</SubTitle>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field icon={Mail} label="Email">{c.email}</Field>
              <Field icon={Phone} label="Phone">{c.phone}</Field>
              <Field icon={Mail} label="Other Emails">{c.otherEmails}</Field>
              <Field icon={Phone} label="Other Phones">{c.otherPhones}</Field>
            </div>

            <Divider />
            <SubTitle>Postal Address</SubTitle>
            <Field icon={Mail} label="Address">{c.postal}</Field>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--teal)]">Other Postal Addresses</p>
            <p className="text-[13px] text-foreground">{c.otherPostal}</p>

            <Divider />
            <SubTitle>Physical Address</SubTitle>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field icon={Building2} label="Building">{c.building}</Field>
              <Field icon={Home} label="Unit">{c.unit}</Field>
              <Field icon={MapPin} label="Street">{c.street}</Field>
              <Field icon={MapIcon} label="Estate">{c.estate}</Field>
              <Field icon={Navigation} label="School">{c.school}</Field>
              <Field icon={Navigation} label="Health Centre">{c.health}</Field>
              <Field icon={Navigation} label="Religious Center">{c.religious}</Field>
              <Field icon={MapIcon} label="Sub-county">{c.subCounty}</Field>
              <Field icon={Globe} label="County">{c.county}</Field>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-[13px] text-foreground">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {c.mapLabel || 'Location'}
            </div>
            <div className="mt-2">
              <MapPanel center={c.mapCenter} zoom={15} label={c.mapLabel} markers={c.markers} polyline={c.polyline} />
            </div>
          </Card>
        </div>

        {/* Row: Residential | Employment */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {/* 3. RESIDENTIAL HISTORY */}
          <Card>
            <SectionTitle n={3}>Residential History</SectionTitle>
            {residential.length ? (
              <div className="space-y-3">
                {residential.map((r, i) => (
                  <div key={i} className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border p-4 sm:grid-cols-2">
                    <Field icon={MapPin} label="Town">{r.town}</Field>
                    <Field icon={Home} label="Address">{r.address}</Field>
                    <Field icon={Globe} label="Country">{r.country}</Field>
                    <Field icon={Hash} label="Plot Number">{r.plot}</Field>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">No residential history recorded.</p>
            )}
          </Card>

          {/* 4. EMPLOYMENT HISTORY */}
          <Card>
            <SectionTitle n={4}>Employment History</SectionTitle>

            <SubTitle>Current Employment</SubTitle>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field icon={Building2} label="Employer Name">{e.current?.employer ?? '—'}</Field>
              <Field icon={Briefcase} label="Job Title">{e.current?.title ?? '—'}</Field>
              <Field icon={Banknote} label="Monthly Income" mono>{e.current?.income ?? '—'}</Field>
              <Field icon={Briefcase} label="Employment Status">{e.current?.status ?? '—'}</Field>
            </div>

            <Divider />
            <SubTitle>Known Employment History</SubTitle>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field icon={Building2} label="Position">{e.history?.position}</Field>
              <Field icon={Building2} label="Department">{e.history?.department}</Field>
              <Field icon={Banknote} label="Salary Band">{e.history?.salaryBand}</Field>
              <Field icon={Building2} label="Employer Name">{e.history?.employer}</Field>
              <Field icon={Calendar} label="Employment Date">{e.history?.date}</Field>
            </div>
            <Divider />
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleRunDecision}
                  disabled={decisionRunning || !decide}
                  className="btn btn-sm disabled:opacity-50"
                  title={decide ? 'Run the credit decision' : 'A decision has already been recorded'}
                >
                  {decisionRunning ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Running…
                    </>
                  ) : (
                    'Run Decision'
                  )}
                </button>
                {book && (
                  <button
                    onClick={handleBook}
                    disabled={booking}
                    className="btn btn-sm disabled:opacity-50"
                    title="Book the approved application and open the account"
                  >
                    {booking ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Booking…
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3 w-3 mr-1.5" />
                        Book
                      </>
                    )}
                  </button>
                )}
              </div>
              {!lifecycle.readyForDecision && decide && (
                <p className="text-[11px] text-muted">
                  Gate evidence is incomplete — the decision service will reject the run until KYC,
                  documents, fraud, income and bureau checks are recorded.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
