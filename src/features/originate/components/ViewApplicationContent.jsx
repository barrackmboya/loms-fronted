// View Application panel body — the four detail sections (KYC report header,
// loan, personal + contact, residential + employment) plus the Run Decision
// action. Data is loaded from GET /api/origination/reports/kyc/?id=<id>
// (mapped by mapKycReport via useKycReport); only the chrome (sticky header +
// close) is provided by SlidePanel.jsx.
import { useEffect, useState } from 'react'
import {
  FileText, FileSearch, Image as ImageIcon, MapPin, Building2, Home, Hash, Globe, Calendar,
  Banknote, Percent, CircleCheck, User, Users, Mail, Phone, Navigation, Map as MapIcon,
  ZoomIn, ZoomOut, ExternalLink, Briefcase, Wallet, Loader2, AlertCircle, FileX,
} from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Skeleton } from '../../../components/ui/skeleton'
import { MapPanel } from '../../../components/MapPanel'
import { useKycReport } from '../hooks/useKycReport'
import { api } from '../../../lib/api'
import { toast } from 'sonner'

/* ------------------------------ helpers ------------------------------- */
const ICON = 'h-3.5 w-3.5 shrink-0 text-[var(--teal)]'

// Loan status → badge tone (status arrives prettified, e.g. "Pending").
const STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  CONDITIONAL: 'warning',
  DECLINE: 'destructive',
  DECLINED: 'destructive',
}

function Card({ className = '', children }) {
  return (
    <section className={`rounded-md border border-border bg-background p-5 ${className}`}>{children}</section>
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
      <p className="text-sm font-medium text-destructive">Failed to load application details</p>
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
        <p className="text-[13px]">No documents uploaded for this application.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h4 className="font-sans text-[14px] font-semibold text-foreground">Application documents</h4>
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
              <ExternalLink className="h-3.5 w-3.5" /> Open original
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

  const handleRunDecision = async () => {
    if (decisionRunning) return
    setDecisionRunning(true)
    try {
      await api.decide(applicationId)
      toast.success('Decision completed successfully.')
    } catch (e) {
      toast.error('Decision failed.', { description: e.message })
    } finally {
      setDecisionRunning(false)
    }
  }

  if (loading) return <PanelSkeleton />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!report) return null

  const {
    customer,
    report: meta,
    loan,
    personal: p,
    documents,
    contact: c,
    residential,
    employment: e,
  } = report

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
            <Field icon={Briefcase} label="Loan product">{loan.product}</Field>
            <Field icon={Briefcase} label="Product type">{loan.productType}</Field>
            <Field icon={Globe} label="Currency">{loan.currency}</Field>
            <Field icon={Banknote} label="Loan amount" mono>{loan.amount}</Field>
            <Field icon={Calendar} label="Loan term">{loan.term}</Field>
            <Field icon={Wallet} label="Monthly payment" mono>{loan.monthly}</Field>
            <Field icon={Percent} label="Interest rate">{loan.interest}</Field>
            <Field icon={Banknote} label="Processing fee">{loan.fee}</Field>
            <Field icon={Percent} label="Cost of credit">{loan.cost}</Field>
            <Field icon={CircleCheck} label="Status">
              <Badge variant={STATUS_TONE[String(loan.status).toUpperCase()] ?? 'warning'} className="align-middle text-xs">{loan.status}</Badge>
            </Field>
            <Field icon={Calendar} label="Submitted">{loan.submitted}</Field>
            <Field icon={Calendar} label="Last updated">{loan.updated}</Field>
          </div>
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
              <Field icon={Calendar} label="Date of Birth">{p.dob}</Field>
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
            <Field icon={MapPin} label="Address">{c.postal}</Field>
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
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleRunDecision}
                disabled={decisionRunning}
                className="btn btn-sm"
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
