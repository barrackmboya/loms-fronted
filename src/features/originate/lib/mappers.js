// Record mapping function — single source of truth for backend field names.
// All field names come from plans/audit-findings.md.

import { formatCurrency, formatDate, prettify } from '../../../lib/format'

/**
 * Map a raw Application record from the backend to the normalized shape
 * used by the Originate module.
 *
 * Backend shape (LoanApplicationSerializer):
 *   id, person (nested: first_name, middle_name, last_name, email, phone_number,
 *   id_number), address (FK id), appl_document, employment (FK id),
 *   loan_product (nested: id, name, ...), requested_amount, monthly_payment,
 *   status, reference, created_at, updated_at
 */
export function mapApplication(raw) {
  if (!raw) return null
  const person = raw.party || {}
  const loanProduct = raw.loan_product || {}
  const fullName = person.name || '—'
  return {
    // Core identifiers
    id: raw.id,
    applicationId: raw.id,
    name: fullName,
    product: loanProduct.name || raw.product || '—',
    amount: raw.requested_amount ?? raw.amount_requested ?? 0,
    tenure: raw.tenure_months ?? 0,
    channel: raw.channel || '—',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    status: raw.status,
    purpose: raw.purpose,
    partyType: person.party_type,
    kycStatus: person.kyc_status,
    // Financial fields (top-level on the application record, per audit)
    statedIncome: raw.stated_income ?? 0,
    verifiedIncome: raw.verified_income ?? 0,
    existingDebtService: raw.existing_debt_service ?? 0,
    bureauScore: raw.bureau_score ?? 0,
    salaryDomiciled: raw.salary_domiciled ?? false,
    collateralValue: raw.collateral_value ?? 0,
    // Extra fields useful for display
    person: person,
    documents: raw.documents || [],
  }
}

/**
 * Map a raw LoanApplication record from the loanapplication list endpoint to
 * the normalized shape used by ApplicationsTab.
 *
 * Backend shape (LoanApplicationSerializer, GET /api/origination/loanapplication/):
 *   id, person ({first_name, middle_name, last_name, email, phone_number, id_number}),
 *   loan_product ({id, name}), requested_amount, loan_term, status, reference,
 *   channel, created_at, updated_at
 */
export function mapLoanApplication(raw) {
  if (!raw) return null
  const person = raw.person || {}
  const loanProduct = raw.loan_product || {}
  const fullName = [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || '—'
  return {
    // Core identifiers
    id: raw.id,
    applicationId: raw.id,
    name: fullName,
    reference: raw.reference || '',
    product: loanProduct.name || '—',
    productClass: raw.product_class || loanProduct.product_class || '',
    segment: raw.segment || loanProduct.segment || '',
    amount: raw.requested_amount ?? 0,
    tenure: raw.loan_term ?? 0,
    channel: raw.channel || '—',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    status: raw.status,
    packStatus: raw.pack_status || '',
    missingDocuments: Array.isArray(raw.missing_documents) ? raw.missing_documents : [],
    kycStatus: person.kyc_status ?? raw.kyc_status ?? raw.party?.kyc_status ?? '',
    person,
  }
}

/**
 * Map a raw DecisionRecord from the backend to the normalized shape.
 *
 * Backend shape (DecisionRecordSerializer):
 *   id, application (FK), decision, policy_version, gates, fraud, pd_12m,
 *   grade, scorecard, affordability, limit, approved_limit, tenor_months,
 *   pricing, collection_propensity, reason_codes, model_versions, as_of_ts
 */
export function mapDecision(raw) {
  if (!raw) return null
  return {
    decisionId: raw.id,
    applicationId: raw.application,
    decision: raw.decision, // APPROVE | CONDITIONAL | DECLINE
    grade: raw.grade,
    pd12m: raw.pd_12m,
    runDate: raw.as_of_ts,
    limit: raw.limit,
    approvedLimit: raw.approved_limit,
    tenorMonths: raw.tenor_months,
    gates: raw.gates,
    fraud: raw.fraud,
    scorecard: raw.scorecard,
    affordability: raw.affordability,
    pricing: raw.pricing,
    collectionPropensity: raw.collection_propensity,
    reasonCodes: raw.reason_codes,
    modelVersions: raw.model_versions,
    policyVersion: raw.policy_version,
  }
}

/**
 * Normalize a decision to a badge tone.
 * APPROVE → 'success' (green)
 * CONDITIONAL → 'warning' (amber)
 * DECLINE → 'destructive' (red)
 */
export function decisionTone(decision) {
  switch (decision) {
    case 'APPROVE':
      return 'success'
    case 'CONDITIONAL':
      return 'warning'
    case 'DECLINE':
      return 'destructive'
    default:
      return 'muted'
  }
}

/**
 * Enrich a mapped decision with applicant name and channel from the
 * corresponding application record.
 */
export function enrichDecision(decision, application) {
  if (!decision || !application) return decision
  return {
    ...decision,
    applicantName: application.name,
    channel: application.channel,
  }
}

/* ----------------------------------------------------------------------------
 * KYC report (View Application panel)
 *
 * Backend payload: GET /api/origination/reports/kyc/?id=<loan_application_id>
 *   data.application_details (LoanApplicationSerializer)
 *   data.requested_amount / loan_term / monthly_payment  ({source, parsedValue})
 *   data.report_ref_number / report_generated_at / report_generated_by / org_name
 *   data.personal_details { passportPhoto, firstName, middleName, lastName,
 *     idNumber, other_aliases, dateOfBirth, gender, marital_status, is_verified,
 *     loan_product, person_documents, contacts {…}, employment[],
 *     known_employment_history[] }
 * -------------------------------------------------------------------------- */

// Amounts arrive as {source, parsedValue} objects, plain numbers or numeric
// strings (e.g. "900000.00").
const readAmount = (value) => {
  if (value == null) return null
  let v = value
  if (typeof v === 'object') v = v.parsedValue ?? v.source
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const formatMoney = (value, currency = 'KES') => {
  const n = readAmount(value)
  if (n == null) return '—'
  if (currency === 'KES') return formatCurrency(n)
  return `${currency} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

const percent = (value) => {
  const n = readAmount(value)
  return n == null ? '—' : `${n}%`
}

// '—' for null/empty/whitespace values, the trimmed string otherwise.
const dash = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim())

const joinList = (items, fallback = '—') => {
  const list = (Array.isArray(items) ? items : []).filter(Boolean)
  return list.length ? list.join(', ') : fallback
}

// "1954-01-01" → "01 Jan 1954 (72 yrs)"
const formatDob = (dob) => {
  if (!dob) return '—'
  const date = new Date(dob)
  if (isNaN(date.getTime())) return dash(dob)
  const formatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return age >= 0 && age < 130 ? `${formatted} (${age} yrs)` : formatted
}

const GENDER_LABELS = { M: 'Male', F: 'Female' }

// Default map center (Nairobi) when the address has no geo markers.
const NAIROBI_CENTER = [-1.2833, 36.8180]

// person_documents is a single record with one file field per document type.
const DOC_FIELDS = [
  ['id_photo_front', 'ID Photo (Front)'],
  ['id_photo_back', 'ID Photo (Back)'],
  ['biometric_photo_1', 'Biometric Photo 1'],
  ['biometric_photo_2', 'Biometric Photo 2'],
  ['biometric_photo_3', 'Biometric Photo 3'],
  ['kra_certificate', 'KRA PIN Certificate'],
  ['proof_of_business', 'Proof of Business'],
  ['bank_statement', 'Bank Statement'],
  ['mpesa_statement', 'M-PESA Statement'],
  ['payslip', 'Payslip'],
  ['utility_bill', 'Utility Bill'],
]

const isImageUrl = (url) => /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(url || '')

// Placeholder files are never real documents: the multi-step flow stores an
// "empty_<random>" file for required fields the applicant didn't upload, and
// the demo flow stores "demo_<field>_<random>" placeholders for the doc types
// its payload declared — don't list either as documents.
const isPlaceholderFile = (url) => /\/(empty|demo_)[^/]*$/.test(url || '')

const mapDocuments = (personDocuments) =>
  DOC_FIELDS
    .map(([id, name]) => {
      const url = personDocuments?.[id]
      if (!url || isPlaceholderFile(url)) return null
      return { id, name, kind: isImageUrl(url) ? 'image' : 'pdf', url }
    })
    .filter(Boolean)

// "P.O. Box 326 - 40202, KEROKA" from an IPRS postal entry; strings pass through.
const formatPostal = (entry) => {
  if (!entry) return null
  if (typeof entry !== 'object') return String(entry).trim() || null
  const box = entry.number ? `P.O. Box ${entry.number}` : null
  const tail = [entry.code, entry.town].filter(Boolean).join(', ')
  return [box, tail].filter(Boolean).join(' - ') || null
}

const mapContact = (contacts = {}) => {
  const physical = (Array.isArray(contacts.physicalAddress) ? contacts.physicalAddress[0] : null) || {}
  const spatial = physical.spatial_dossier || {}
  const markers = (Array.isArray(spatial.markers) ? spatial.markers : [])
    .filter((m) => Number.isFinite(Number(m?.latitude)) && Number.isFinite(Number(m?.longitude)))
    .map((m) => ({
      id: m.id,
      label: m.label,
      category: m.category,
      color: m.color,
      position: [Number(m.latitude), Number(m.longitude)],
    }))
  const mapCenter = markers[0]?.position ?? NAIROBI_CENTER
  const mapLabel = markers[0]?.label || physical.street_or_road_name || physical.county || ''
  return {
    email: dash(contacts.email),
    phone: joinList(contacts.phone_numbers),
    otherEmails: joinList(contacts.other_emails),
    otherPhones: joinList(contacts.other_phone_numbers),
    postal: dash(contacts.postalAddress),
    otherPostal: joinList((contacts.otherPostalAddresses || []).map(formatPostal)),
    building: dash(physical.building_or_premise),
    unit: dash(physical.unit_or_house_number),
    street: dash(physical.street_or_road_name),
    estate: dash(physical.estate_or_neighborhood),
    school: dash(physical.landmark_school),
    health: dash(physical.landmark_health),
    religious: dash(physical.landmark_church),
    subCounty: dash(physical.sub_county),
    county: dash(physical.county),
    mapLabel,
    mapCenter,
    markers,
    polyline: Array.isArray(spatial.street_polyline?.coordinates) && spatial.street_polyline.coordinates.length
      ? { name: spatial.street_polyline.name, coordinates: spatial.street_polyline.coordinates }
      : null,
  }
}

/**
 * Map the KYC report payload to the view model rendered by
 * ViewApplicationContent.jsx.
 */
export function mapKycReport(raw) {
  if (!raw) return null
  const app = raw.application_details || {}
  const person = app.person || {}
  const product = raw.personal_details?.loan_product || app.loan_product || {}
  const p = raw.personal_details || {}
  const currency = product.currency || 'KES'
  const fullName =
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() ||
    [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ').trim() ||
    '—'

  const currentEmployment = (Array.isArray(p.employment) ? p.employment[0] : null) || null
  const knownHistory = (Array.isArray(p.known_employment_history) ? p.known_employment_history[0] : null) || {}

  // Lifecycle + gate evidence (ORG-02, DEC-01). The detail panel shows what the
  // backend will check before it agrees to score or book the file.
  const kycStatus = person.kyc_status || app.kyc_status || app.party?.kyc_status || ''
  const sanctionsStatus = person.sanctions_status || app.sanctions_status || ''
  const packStatus = app.pack_status || ''
  const fraudDecision = app.fraud_decision || ''
  const verifiedIncome = readAmount(app.verified_income)
  const bureauScore = app.bureau_score == null ? null : Number(app.bureau_score)
  const missingDocuments = Array.isArray(app.missing_documents) ? app.missing_documents : []
  const gates = {
    kyc: String(kycStatus).toUpperCase() === 'VERIFIED' && String(sanctionsStatus).toUpperCase() === 'CLEAR',
    documents: String(packStatus).toUpperCase() === 'ACCEPTED',
    fraud: !!fraudDecision && String(fraudDecision).toUpperCase() !== 'BLOCK',
    income: verifiedIncome != null && verifiedIncome > 0,
    bureau: bureauScore != null,
  }
  const readyForDecision = gates.kyc && gates.documents && gates.fraud && gates.income && gates.bureau

  return {
    customer: fullName,
    report: {
      title: dash(raw.report_title),
      reference: dash(raw.report_ref_number),
      organization: dash(raw.org_name),
      generatedAt: dash(raw.report_generated_at),
      generatedBy: dash(raw.report_generated_by),
      purpose: dash(raw.report_purpose),
    },
    loan: {
      product: dash(product.name),
      productType: dash(product.product_type),
      productClass: dash(app.product_class || product.product_class),
      segment: dash(app.segment || product.segment),
      currency,
      amount: formatMoney(raw.requested_amount ?? app.requested_amount, currency),
      term: raw.loan_term ? `${raw.loan_term} ${raw.loan_term === 1 ? 'month' : 'months'}` : '—',
      monthly: readAmount(raw.monthly_payment ?? app.monthly_payment) ? formatMoney(raw.monthly_payment ?? app.monthly_payment, currency) : '—',
      interest: percent(product.interest_rate),
      fee: dash(product.processing_fee),
      cost: percent(product.cost_of_credit),
      status: dash(app.status) === '—' ? '—' : prettify(app.status),
      statusRaw: app.status || '',
      reference: dash(app.reference ?? raw.loan_aplication_ref),
      submitted: formatDate(app.created_at),
      updated: formatDate(app.updated_at),
    },
    lifecycle: {
      statusRaw: app.status || '',
      reference: dash(app.reference ?? raw.loan_aplication_ref),
      productClass: dash(app.product_class || product.product_class),
      segment: dash(app.segment || product.segment),
      kycStatus: dash(kycStatus),
      sanctionsStatus: dash(sanctionsStatus),
      packStatus: dash(packStatus),
      missingDocuments,
      fraudDecision: dash(fraudDecision),
      conditionsStatus: dash(app.conditions_status),
      verifiedIncome: verifiedIncome == null ? '—' : formatMoney(verifiedIncome, currency),
      bureauScore: bureauScore == null ? '—' : String(bureauScore),
      collateralValue: readAmount(app.collateral_value) ? formatMoney(app.collateral_value, currency) : '—',
      decisionAt: app.decision_at ? formatDate(app.decision_at) : '—',
      readyForDecision,
      gates,
    },
    declarations: {
      monthlyExpenses: formatMoney(app.monthly_expenses, currency),
      dependents: app.dependents ?? 0,
      rentOrHousing: formatMoney(app.rent_or_housing, currency),
      otherIncome: formatMoney(app.other_income, currency),
      existingDebtService: formatMoney(app.existing_debt_service, currency),
      existingDebtBreakdown: Array.isArray(app.existing_debt_breakdown)
        ? app.existing_debt_breakdown
        : [],
    },
    personal: {
      firstName: dash(p.firstName),
      surname: dash(p.lastName),
      otherNames: dash(p.middleName),
      idNumber: dash(p.idNumber ?? person.id_number),
      dob: formatDob(p.dateOfBirth),
      gender: GENDER_LABELS[p.gender] || dash(p.gender),
      marital: dash(p.marital_status),
      aliases: joinList(p.other_aliases),
      verified: p.is_verified ? 'Yes' : 'No',
      photo: p.passportPhoto || null,
    },
    documents: mapDocuments(p.person_documents),
    contact: mapContact(p.contacts),
    residential: (Array.isArray(p.contacts?.residential_history) ? p.contacts.residential_history : [])
      .map((r) => ({
        town: dash(r?.town),
        address: dash(r?.address),
        country: dash(r?.country),
        plot: dash(r?.plot_number),
      })),
    employment: {
      current: currentEmployment && {
        employer: dash(currentEmployment.employer_name),
        title: dash(currentEmployment.job_title),
        employerPin: dash(currentEmployment.employer_pin),
        employerAddress: dash(currentEmployment.employer_address),
        income: formatMoney(currentEmployment.monthly_income, currency),
        status: currentEmployment.employment_status ? prettify(currentEmployment.employment_status) : '—',
        // Additional employer/business fields for decisioning
        employeeId: dash(currentEmployment.employee_id),
        employmentType: dash(currentEmployment.employment_type),
        yearsAtEmployer: dash(currentEmployment.years_at_employer),
        industrySector: dash(currentEmployment.industry_sector),
        salaryPaymentMethod: dash(currentEmployment.salary_payment_method),
        nssfNumber: dash(currentEmployment.nssf_number),
        nhifNumber: dash(currentEmployment.nhif_number),
        employerRegistrationNumber: dash(currentEmployment.employer_registration_number),
        employerSize: dash(currentEmployment.employer_size),
        employerPhone: dash(currentEmployment.employer_phone),
        employerEmail: dash(currentEmployment.employer_email),
      },
      history: {
        position: dash(knownHistory.position),
        department: dash(knownHistory.department),
        salaryBand: dash(knownHistory.salary_band),
        employer: dash(knownHistory.employer_name),
        date: dash(knownHistory.employment_date),
      },
    },
  }
}