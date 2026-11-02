// Record mapping function — single source of truth for backend field names.
// All field names come from plans/audit-findings.md.

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