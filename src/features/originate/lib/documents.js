// Document pack contract shared by the wizard, review step and applications list.
//
// The authoritative pack lives in the policy pack
// (`required_documents_by_class`). This module mirrors the default matrix so the
// form can explain what is missing before submitting; the backend still runs
// `sync_pack_status`/G2 and remains the source of truth.

export const DOC_LABELS = {
  ID: 'National ID',
  PAYSLIP: 'Payslip',
  BANK_STATEMENT: 'Bank statement',
  MPESA_STATEMENT: 'M-PESA statement',
  KRA_PIN: 'KRA PIN certificate',
  PROOF_OF_BUSINESS: 'Proof of business',
  UTILITY_BILL: 'Utility bill',
  COLLATERAL: 'Collateral evidence',
}

// Server-side slot names (PersonDocument fields) → canonical doc type.
export const SLOT_TO_DOC_TYPE = {
  id_photo_front: 'ID',
  id_photo_back: 'ID',
  kra_certificate: 'KRA_PIN',
  proof_of_business: 'PROOF_OF_BUSINESS',
  bank_statement: 'BANK_STATEMENT',
  mpesa_statement: 'MPESA_STATEMENT',
  payslip: 'PAYSLIP',
  utility_bill: 'UTILITY_BILL',
}

export const DEFAULT_PACK_BY_CLASS = {
  UNSECURED: ['ID', 'PAYSLIP', 'BANK_STATEMENT'],
  SECURED: ['ID', 'PAYSLIP', 'BANK_STATEMENT', 'COLLATERAL'],
  REVOLVING: ['ID', 'BANK_STATEMENT'],
  TRADE: ['ID', 'PROOF_OF_BUSINESS', 'BANK_STATEMENT'],
}

export const DEFAULT_REQUIRED_DOCUMENTS = DEFAULT_PACK_BY_CLASS.UNSECURED

/**
 * Pick the pack for a product class from the policy payload when available.
 * Accepts both the raw policy (`required_documents_by_class`) and the wrapped
 * `{ params }` shape /api/policy returns.
 */
export function requiredPack(productClass, policy) {
  const params = policy?.params || policy || {}
  const byClass = params.required_documents_by_class || {}
  const cls = String(productClass || 'UNSECURED').toUpperCase()
  const pack = byClass[cls] || params.required_documents || DEFAULT_PACK_BY_CLASS[cls]
  return Array.isArray(pack) ? pack : DEFAULT_REQUIRED_DOCUMENTS
}

// A zero-byte slot or the legacy "empty" placeholder is not evidence (DOC-10).
export function isRealFile(file) {
  if (!file) return false
  if (typeof File !== 'undefined' && file instanceof File) {
    return file.size > 0 && !/^empty/i.test(file.name || '')
  }
  return !!(file.name && !/^empty/i.test(file.name) && Number(file.size || 1) > 0)
}

export const DOC_SLOT_FIELDS = [
  { key: 'id_photo_combined', label: 'Combined ID (front + back PDF)', accept: '.pdf', docType: 'ID' },
  { key: 'id_photo_front', label: 'National ID — front', accept: '.jpg,.jpeg,.png,.pdf', docType: 'ID' },
  { key: 'id_photo_back', label: 'National ID — back', accept: '.jpg,.jpeg,.png,.pdf', docType: 'ID' },
  { key: 'kra_certificate', label: 'KRA PIN certificate', accept: '.pdf,.jpg,.jpeg,.png', docType: 'KRA_PIN' },
  { key: 'proof_of_business', label: 'Proof of business (registration / permit)', accept: '.pdf,.jpg,.jpeg,.png', docType: 'PROOF_OF_BUSINESS' },
  { key: 'utility_bill', label: 'Utility bill (address evidence)', accept: '.pdf,.jpg,.jpeg,.png', docType: 'UTILITY_BILL' },
  { key: 'payslip', label: 'Payslip (latest)', accept: '.pdf,.jpg,.jpeg', docType: 'PAYSLIP' },
  { key: 'bank_statement', label: 'Bank statement (3 months)', accept: '.pdf,.jpg,.jpeg', docType: 'BANK_STATEMENT' },
  { key: 'mpesa_statement', label: 'M-PESA statement', accept: '.pdf,.jpg,.jpeg', docType: 'MPESA_STATEMENT' },
]

export function uploadedDocTypes(formData = {}) {
  const types = new Set()
  for (const { key, docType } of DOC_SLOT_FIELDS) {
    if (isRealFile(formData[key])) types.add(docType)
  }
  return types
}

// ID evidence is complete only with both sides, or one combined front+back PDF.
// A single front photo must not make the pack look complete.
export function identityEvidenceComplete(formData = {}) {
  if (isRealFile(formData.id_photo_combined)) return true
  return isRealFile(formData.id_photo_front) && isRealFile(formData.id_photo_back)
}

/** Pack with the ID slot judged by `identityEvidenceComplete`. */
export function missingPack(formData, required = DEFAULT_REQUIRED_DOCUMENTS) {
  const uploaded = uploadedDocTypes(formData)
  return required.filter((docType) => {
    if (String(docType).toUpperCase() === 'ID') return !identityEvidenceComplete(formData)
    return !uploaded.has(docType)
  })
}

export function missingDocuments(formData, required = DEFAULT_REQUIRED_DOCUMENTS) {
  return missingPack(formData, required)
}

export function packChecklist(formData, required = DEFAULT_REQUIRED_DOCUMENTS) {
  const uploaded = uploadedDocTypes(formData)
  return required.map((docType) => {
    const isId = String(docType).toUpperCase() === 'ID'
    return {
      docType,
      label: DOC_LABELS[docType] || docType,
      uploaded: isId ? identityEvidenceComplete(formData) : uploaded.has(docType),
    }
  })
}

export function docLabel(docType) {
  return DOC_LABELS[String(docType || '').toUpperCase()] || docType
}

export function acceptsFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`
  if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
    return { ok: false, error: 'Only PDF, JPG, JPEG and PNG files are accepted.' }
  }
  if (file.size > 12 * 1024 * 1024) {
    return { ok: false, error: 'File exceeds the 12 MB limit.' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'The selected file is empty.' }
  }
  return { ok: true }
}
