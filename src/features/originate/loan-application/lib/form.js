// Shared wizard contract: initial state, steps, validation and the canonical
// multipart payload for POST /api/origination/loanapplication/.
//
// This module exists because the dialog, the standalone page and the review
// step used to carry three copies of INITIAL_FORM with different field names
// (firstName vs first_name). The backend contract is snake_case; everything
// here uses it so a value written by a step is the value that is submitted.

import {
  DOC_SLOT_FIELDS,
  isRealFile,
  missingPack,
  requiredPack,
} from '../../lib/documents'

export const DECLARATION_VERSION = 'v1'
export const CONSENT_VERSION = 'v1'

export const ID_TYPES = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVER_LICENSE', label: "Driver's licence" },
  { value: 'ALIEN_ID', label: 'Alien ID' },
]

export const ID_TYPES_REQUIRING_EXPIRY = new Set(['PASSPORT', 'DRIVER_LICENSE', 'ALIEN_ID'])

export const PURPOSES = [
  { value: 'PERSONAL', label: 'Personal / household' },
  { value: 'BUSINESS', label: 'Business working capital' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'HOME_IMPROVEMENT', label: 'Home improvement' },
  { value: 'DEBT_CONSOLIDATION', label: 'Debt consolidation' },
  { value: 'VEHICLE', label: 'Vehicle purchase' },
  { value: 'OTHER', label: 'Other' },
]

export const EMPLOYMENT_STATUSES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED_PROFESSIONAL', label: 'Self-employed professional' },
  { value: 'SELF_EMPLOYED_BUSINESS', label: 'Self-employed business owner' },
]

// Required consents. The backend records each purpose + version on the
// application (`ApplicationConsent`), so the UI must capture them explicitly.
export const CONSENTS = [
  {
    key: 'BUREAU_PULL',
    label: 'Credit bureau enquiry',
    description: 'I authorise a credit bureau enquiry and the use of the returned score for this application.',
  },
  {
    key: 'ACCOUNT_AGGREGATOR',
    label: 'Account aggregator / statement access',
    description: 'I authorise retrieval of bank or mobile-money statements for affordability and fraud checks.',
  },
  {
    key: 'KYC_VERIFICATION',
    label: 'Identity verification',
    description: 'I authorise identity, sanctions/PEP and biometric verification as required for KYC.',
  },
]

export const STEPS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'loan', label: 'Loan Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'income', label: 'Income & Declarations' },
  { key: 'address', label: 'Address' },
  { key: 'review', label: 'Review & Submit' },
]

export const INITIAL_ADDRESS = {
  county: null,
  subcounty: null,
  ward: null,
  neighborhood: null,
  street: null,
  landmark: null,
  landmarks: [],
  lat: null,
  lng: null,
  plot_number: '',
  postal_code: '',
  building_or_premise: '',
  unit_or_house_number: '',
}

export const INITIAL_FORM = {
  channel: 'APP',

  // Identity
  first_name: '',
  middle_name: '',
  last_name: '',
  id_number: '',
  id_type: 'NATIONAL_ID',
  issuing_country: 'KE',
  id_expiry: '',
  date_of_birth: '',
  email: '',
  phone: '',
  email_verified: false,
  phone_verified: false,

  // Loan request
  loan_product: '',
  loan_product_id: null,
  amount_requested: '',
  loan_term: '',
  purpose: 'PERSONAL',
  collateral_value: '',

  // Employment / income
  employment_status: '',
  employer_name: '',
  monthly_income: '',
  payslip_date: '',
  salary_domiciled: false,

  // Declarations (ORG-12 / DEC-05)
  monthly_expenses: '',
  dependents: '',
  rent_or_housing: '',
  other_income: '',
  existing_debt_service: '',
  existing_debt_breakdown: [],

  // Documents — one slot per PersonDocument file field plus the combined ID.
  id_photo_combined: null,
  id_photo_front: null,
  id_photo_back: null,
  kra_certificate: null,
  proof_of_business: null,
  utility_bill: null,
  payslip: null,
  bank_statement: null,
  mpesa_statement: null,

  // Liveness photos are captured as data URLs by LivenessStep and converted
  // to biometric_photo_1..3 files at submit time.
  personal: {
    photos: { front: null, left: null, right: null, capturedAt: null },
  },

  address: { ...INITIAL_ADDRESS },

  // Attestations
  declarations_accepted: false,
  sanctions_screened: false,
  consents: {
    BUREAU_PULL: false,
    ACCOUNT_AGGREGATOR: false,
    KYC_VERIFICATION: false,
  },
}

export function newDebtRow() {
  return { type: '', lender: '', monthly_amount: '', outstanding_balance: '' }
}

/** A fresh wizard state with cloned nested objects (never share INITIAL_FORM). */
export function createInitialForm() {
  return {
    ...INITIAL_FORM,
    existing_debt_breakdown: [],
    address: { ...INITIAL_ADDRESS },
    personal: { photos: { front: null, left: null, right: null, capturedAt: null } },
    consents: { ...INITIAL_FORM.consents },
  }
}

/* ------------------------------- helpers -------------------------------- */

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const money = (value) => {
  const n = toNumber(value)
  return n != null && n >= 0
}

const dateValue = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const ageOn = (dob, at = new Date()) => {
  let age = at.getFullYear() - dob.getFullYear()
  const beforeBirthday =
    at.getMonth() < dob.getMonth() ||
    (at.getMonth() === dob.getMonth() && at.getDate() < dob.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function isKenyanPhone(value) {
  return /^(?:\+?254|0)[17]\d{8}$/.test(String(value || '').replace(/[\s-]/g, ''))
}

export function formatFullName(formData = {}) {
  return [formData.first_name, formData.middle_name, formData.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function selectedProduct(products, formData) {
  if (!Array.isArray(products) || !products.length) return null
  if (formData?.loan_product_id != null) {
    const byId = products.find((p) => String(p.id) === String(formData.loan_product_id))
    if (byId) return byId
  }
  return products.find((p) => p.name === formData?.loan_product) || null
}

/** Product-class pack with COLLATERAL left to the secured-collateral workflow. */
export function requiredDocumentsFor(product) {
  const pack = requiredPack(product?.product_class)
  return pack.filter((docType) => docType !== 'COLLATERAL')
}

/* ------------------------------ validation ------------------------------ */

function validatePersonal(form) {
  const errors = []
  if (!form.first_name?.trim()) errors.push('First name is required.')
  if (!form.last_name?.trim()) errors.push('Last name is required.')
  if (!form.id_number?.trim()) errors.push('National ID number is required.')
  else if (!/^[A-Za-z0-9-]{5,20}$/.test(form.id_number.trim())) {
    errors.push('National ID number must be 5–20 letters or digits.')
  }
  if (!form.id_type) errors.push('ID type is required.')
  if (!form.issuing_country?.trim()) errors.push('Issuing country is required.')

  if (ID_TYPES_REQUIRING_EXPIRY.has(form.id_type)) {
    if (!form.id_expiry) errors.push('ID expiry date is required for this ID type.')
    else if (dateValue(form.id_expiry) <= new Date()) errors.push('The ID has expired.')
  }

  if (!form.date_of_birth) errors.push('Date of birth is required.')
  else {
    const dob = dateValue(form.date_of_birth)
    if (!dob) errors.push('Date of birth is not a valid date.')
    else {
      const age = ageOn(dob)
      if (age < 18) errors.push('The applicant must be at least 18 years old.')
      if (age > 100) errors.push('Date of birth looks invalid.')
    }
  }

  if (!form.email?.trim()) errors.push('Email is required.')
  else if (!isEmail(form.email)) errors.push('Email address is not valid.')
  if (!form.phone?.trim()) errors.push('Phone number is required.')
  else if (!isKenyanPhone(form.phone)) {
    errors.push('Phone number must be a valid Kenyan number (e.g. 0712345678).')
  }

  // Contact verification gate — both must be verified before advancing
  if (form.email && !form.email_verified) {
    errors.push('Email must be verified before continuing.')
  }
  if (form.phone && !form.phone_verified) {
    errors.push('Phone number must be verified before continuing.')
  }
  return errors
}

function validateLoan(form, product) {
  const errors = []
  if (!form.loan_product) errors.push('Loan product is required.')

  const amount = toNumber(form.amount_requested)
  const tenure = toNumber(form.loan_term)
  const minAmount = Number(product?.min_amount ?? 1)
  const maxAmount = Number(product?.max_amount ?? Infinity)
  const minTenure = Number(product?.min_tenure_months ?? 1)
  const maxTenure = Number(product?.max_tenure_months ?? 84)

  if (amount == null || amount <= 0) errors.push('Requested amount is required.')
  else if (amount < minAmount || amount > maxAmount) {
    errors.push(
      `Amount must be between KES ${minAmount.toLocaleString()} and KES ${maxAmount.toLocaleString()}.`,
    )
  }

  if (tenure == null || !Number.isInteger(tenure) || tenure < 1) {
    errors.push('Loan term must be a whole number of months.')
  } else if (tenure < minTenure || tenure > maxTenure) {
    errors.push(`Loan term must be between ${minTenure} and ${maxTenure} months.`)
  }

  if (!form.purpose) errors.push('Purpose is required.')

  if (form.collateral_value !== '' && form.collateral_value != null) {
    const value = toNumber(form.collateral_value)
    if (value == null || value < 0) errors.push('Collateral value must be zero or more.')
  }
  return errors
}

function validateDocuments(form, required) {
  const missing = missingPack(form, required)
  const errors = []
  if (!missing.length) return []
  errors.push(`Upload the required documents: ${missing.join(', ')}.`)
  return errors
}

function validateIncome(form) {
  const errors = []
  if (!form.employment_status) errors.push('Employment status is required.')
  if (!form.employer_name?.trim()) {
    errors.push(
      form.employment_status === 'EMPLOYED' ? 'Employer name is required.' : 'Occupation or business name is required.',
    )
  }
  const income = toNumber(form.monthly_income)
  if (income == null || income <= 0) errors.push('Monthly income must be greater than zero.')

  if (form.employment_status === 'EMPLOYED') {
    if (!form.payslip_date) errors.push('Payslip date is required for employed applicants.')
    else {
      const d = dateValue(form.payslip_date)
      if (!d) errors.push('Payslip date is not a valid date.')
      else if (d > new Date()) errors.push('Payslip date cannot be in the future.')
    }
  }

  if (!money(form.monthly_expenses)) errors.push('Monthly expenses must be zero or more.')
  if (form.dependents === '' || form.dependents == null) errors.push('Number of dependants is required.')
  else {
    const dependents = Number(form.dependents)
    if (!Number.isInteger(dependents) || dependents < 0) {
      errors.push('Number of dependants must be a whole number.')
    }
  }
  if (!money(form.rent_or_housing)) errors.push('Rent or housing cost must be zero or more.')
  if (!money(form.other_income)) errors.push('Other income must be zero or more.')
  if (!money(form.existing_debt_service)) errors.push('Existing debt service must be zero or more.')

  for (const row of form.existing_debt_breakdown || []) {
    const hasAny = [row.type, row.lender, row.monthly_amount, row.outstanding_balance].some(
      (v) => v !== '' && v != null,
    )
    if (!hasAny) continue
    if (!row.type?.trim()) errors.push('Every debt row needs a type.')
    if (!money(row.monthly_amount)) errors.push('Every debt row needs a monthly amount.')
  }
  return errors
}

function validateAddress(form) {
  const a = form.address || {}
  const landmarkSelections = (a.landmarks || []).filter((l) => l.type !== 'street')
  const selectedCount = (a.street ? 1 : 0) + landmarkSelections.length
  const errors = []
  if (!a.county) errors.push('County is required.')
  if (!a.subcounty) errors.push('Sub-county is required.')
  if (!a.ward) errors.push('Ward is required.')
  if (!a.neighborhood) errors.push('Neighbourhood is required.')
  if (selectedCount < 3) errors.push('Select at least 3 landmarks / a street.')
  return errors
}

function validateReview(form) {
  const errors = []
  if (!form.declarations_accepted) errors.push('You must accept the declaration.')
  if (!form.sanctions_screened) {
    errors.push('Confirm that sanctions / PEP screening was completed.')
  }
  for (const consent of CONSENTS) {
    if (!form.consents?.[consent.key]) errors.push(`Consent required: ${consent.label}.`)
  }
  return errors
}

export function validateStep(key, form, { product } = {}) {
  switch (key) {
    case 'personal':
      return validatePersonal(form)
    case 'loan':
      return validateLoan(form, product)
    case 'documents':
      return validateDocuments(form, requiredDocumentsFor(product))
    case 'income':
      return validateIncome(form)
    case 'address':
      return validateAddress(form)
    case 'review':
      return validateReview(form)
    default:
      return []
  }
}

export function validateApplication(form, context = {}) {
  return STEPS.flatMap((step) => validateStep(step.key, form, context))
}

/* ------------------------------- payload -------------------------------- */

function addressPayload(address = {}) {
  const payload = {}
  const set = (key, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      payload[key] = String(value).trim()
    }
  }
  set('building_or_premise', address.building_or_premise)
  set('unit_or_house_number', address.unit_or_house_number || address.plot_number)
  set('street_or_road_name', address.street_or_road_name || address.street?.name)
  set('estate_or_neighborhood', address.estate_or_neighborhood || address.neighborhood?.name)
  set('sub_county', address.sub_county || address.subcounty?.name)
  set('county', address.county?.name || address.county)
  set('postal_code', address.postal_code)

  if (address.landmark_school) payload.landmark_school = address.landmark_school
  if (address.landmark_health) payload.landmark_health = address.landmark_health
  if (address.landmark_church) payload.landmark_church = address.landmark_church

  for (const landmark of address.landmarks || []) {
    const name = landmark?.name
    if (!name) continue
    if (landmark.type === 'school') payload.landmark_school = name
    else if (landmark.type === 'health_center') payload.landmark_health = name
    else if (landmark.type === 'market' || landmark.type === 'church') {
      payload.landmark_church = name
    } else if (landmark.type === 'building') {
      payload.building_or_premise = name
    }
  }
  return payload
}

function cleanedDebt(form) {
  return (form.existing_debt_breakdown || [])
    .map((row) => ({
      type: (row.type || '').trim(),
      lender: (row.lender || '').trim(),
      monthly_amount: toNumber(row.monthly_amount) ?? 0,
      outstanding_balance: toNumber(row.outstanding_balance) ?? 0,
    }))
    .filter((row) => row.type || row.lender || row.monthly_amount || row.outstanding_balance)
}

/**
 * Build the flat canonical payload the multi-step endpoint expects. File
 * slots are included as File objects and appended to FormData by the hook.
 */
export function buildApplicationPayload(form, { channel = 'APP' } = {}) {
  const payload = {
    channel: channel || form.channel || 'APP',

    first_name: form.first_name?.trim() || '',
    middle_name: form.middle_name?.trim() || '',
    last_name: form.last_name?.trim() || '',

    id_number: form.id_number?.trim() || '',
    id_type: form.id_type || 'NATIONAL_ID',
    issuing_country: form.issuing_country?.trim().toUpperCase() || 'KE',

    email: form.email?.trim() || '',
    phone: form.phone?.trim() || '',
    email_verified: !!form.email_verified,
    phone_verified: !!form.phone_verified,

    loan_product: form.loan_product,
    requested_amount: toNumber(form.amount_requested),
    tenure_months: toNumber(form.loan_term),
    purpose: form.purpose || 'PERSONAL',

    employment_status: form.employment_status || '',
    employer_name: form.employer_name?.trim() || '',
    monthly_income: toNumber(form.monthly_income) ?? 0,
    stated_income: toNumber(form.monthly_income) ?? 0,

    salary_domiciled: !!form.salary_domiciled,

    monthly_expenses: toNumber(form.monthly_expenses) ?? 0,
    dependents: toNumber(form.dependents) ?? 0,
    rent_or_housing: toNumber(form.rent_or_housing) ?? 0,
    other_income: toNumber(form.other_income) ?? 0,
    existing_debt_service: toNumber(form.existing_debt_service) ?? 0,
    existing_debt_breakdown: cleanedDebt(form),
    declaration_version: DECLARATION_VERSION,

    consents: CONSENTS.filter((c) => form.consents?.[c.key]).map((c) => c.key),
    consent_version: CONSENT_VERSION,

    ...addressPayload(form.address),
  }

  if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
  if (form.id_expiry) payload.id_expiry = form.id_expiry
  if (form.payslip_date) payload.payslip_date = form.payslip_date

  if (form.collateral_value !== '' && form.collateral_value != null) {
    payload.collateral_value = toNumber(form.collateral_value) ?? 0
  }

  // An explicit operator attestation is a stated screening result. Without it
  // the backend correctly leaves the applicant NOT_SCREENED (POL-05).
  if (form.sanctions_screened) {
    payload.sanctions_hit = false
    payload.sanctions_status = 'CLEAR'
  }

  // Identity: a combined PDF stands in for both sides, otherwise both slots
  // must carry the same real evidence.
  if (isRealFile(form.id_photo_combined)) {
    payload.id_photo_front = form.id_photo_combined
    payload.id_photo_back = form.id_photo_combined
  } else {
    if (isRealFile(form.id_photo_front)) payload.id_photo_front = form.id_photo_front
    if (isRealFile(form.id_photo_back)) payload.id_photo_back = form.id_photo_back
  }

  for (const { key } of DOC_SLOT_FIELDS) {
    if (key.startsWith('id_photo_')) continue
    if (isRealFile(form[key])) payload[key] = form[key]
  }

  return payload
}
