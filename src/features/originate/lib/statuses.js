// Canonical LoanApplication lifecycle (origination_gap_analysis.md ORG-02).
//
// The backend owns the transition table; this module is the single frontend
// source for labels, tones and the two actions the UI can take. Keeping it in
// one place stops the table, the detail panel and the wizard from inventing
// their own status vocabulary.

export const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'secondary', step: 0 },
  PENDING: { label: 'Captured ', tone: 'warning', step: 1 },
  SUBMITTED: { label: 'Submitted', tone: 'warning', step: 1 },
  KYC_PENDING: { label: 'KYC pending', tone: 'warning', step: 2 },
  KYC_VERIFIED: { label: 'KYC verified', tone: 'success', step: 3 },
  EDD: { label: 'Enhanced due diligence', tone: 'warning', step: 3 },
  KYC_FAILED: { label: 'KYC failed', tone: 'destructive', step: 3 },
  DOC_PENDING: { label: 'Documents pending', tone: 'warning', step: 4 },
  DOC_VERIFIED: { label: 'Documents verified', tone: 'success', step: 5 },
  DOC_REJECTED: { label: 'Documents rejected', tone: 'destructive', step: 5 },
  FRAUD_REVIEW: { label: 'Fraud review', tone: 'warning', step: 6 },
  FRAUD_PASS: { label: 'Fraud clear', tone: 'success', step: 7 },
  FRAUD_BLOCK: { label: 'Fraud blocked', tone: 'destructive', step: 7 },
  UNDERWRITING: { label: 'Underwriting', tone: 'warning', step: 8 },
  APPROVE: { label: 'Approved', tone: 'success', step: 9 },
  CONDITIONAL: { label: 'Conditional approval', tone: 'warning', step: 9 },
  DECLINE: { label: 'Declined', tone: 'destructive', step: 9 },
  READY_TO_BOOK: { label: 'Ready to book', tone: 'success', step: 10 },
  BOOKED: { label: 'Booked', tone: 'success', step: 11 },
  WITHDRAWN: { label: 'Withdrawn', tone: 'secondary', step: 12 },
  EXPIRED: { label: 'Expired', tone: 'secondary', step: 12 },
}

// The funnel shown in the detail panel. Legacy/terminal states are omitted from
// the progress rail but still render as a badge.
export const FUNNEL = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'KYC', label: 'KYC' },
  { key: 'DOCS', label: 'Documents' },
  { key: 'FRAUD', label: 'Fraud' },
  { key: 'DECISION', label: 'Decision' },
  { key: 'BOOKED', label: 'Booked' },
]

const FUNNEL_ORDER = {
  DRAFT: 0, PENDING: 1, SUBMITTED: 1,
  KYC_PENDING: 1, KYC_VERIFIED: 2, EDD: 2, KYC_FAILED: 2,
  DOC_PENDING: 2, DOC_VERIFIED: 3, DOC_REJECTED: 3,
  FRAUD_REVIEW: 3, FRAUD_PASS: 4, FRAUD_BLOCK: 4,
  UNDERWRITING: 4, APPROVE: 5, CONDITIONAL: 5, DECLINE: 5,
  READY_TO_BOOK: 5, BOOKED: 6, WITHDRAWN: 0, EXPIRED: 0,
}

export function statusMeta(status) {
  const key = String(status || '').toUpperCase()
  return STATUS_META[key] || { label: status ? String(status) : 'Unknown', tone: 'secondary', step: 0 }
}

export function statusLabel(status) {
  return statusMeta(status).label
}

export function statusTone(status) {
  return statusMeta(status).tone
}

export function funnelIndex(status) {
  return FUNNEL_ORDER[String(status || '').toUpperCase()] ?? 0
}

const DECIDED_OR_CLOSED = new Set([
  'APPROVE', 'CONDITIONAL', 'DECLINE', 'READY_TO_BOOK', 'BOOKED',
  'WITHDRAWN', 'EXPIRED', 'KYC_FAILED', 'DOC_REJECTED', 'FRAUD_BLOCK',
])

/** Decisioning refuses these states; the button mirrors that contract. */
export function canRunDecision(status) {
  return !DECIDED_OR_CLOSED.has(String(status || '').toUpperCase())
}

/** Booking is allowed only after a positive decision and satisfied conditions. */
export function canBook(status) {
  return ['APPROVE', 'CONDITIONAL', 'READY_TO_BOOK'].includes(
    String(status || '').toUpperCase(),
  )
}

export function isTerminal(status) {
  return ['BOOKED', 'WITHDRAWN', 'EXPIRED'].includes(String(status || '').toUpperCase())
}
