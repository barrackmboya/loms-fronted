// Loan application hook — consumes POST/GET /api/origination/loanapplication/
// POST: creates a new loan application from form state.
// GET:  fetches a single application by ID for the SlidePanel detail view.
//
// Uses the project's existing fetch wrapper (lib/api.js) — no new HTTP client.

import { useCallback, useState } from 'react'
import { api } from '../../../../lib/api'
import { toast } from '../../../../components/ui/sonner'

export function useLoanApplication() {
  const [submitting, setSubmitting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState(null)
  const [application, setApplication] = useState(null)
  const [applicationId, setApplicationId] = useState(null)

  // ---------- POST: create application ----------

  const submitApplication = useCallback(async (formData) => {
    setSubmitting(true)
    setError(null)
    setApplicationId(null)

    try {
      const payload = mapFormToPayload(formData)

      const result = await api.post('/api/origination/loanapplication/', payload)

      const id = result.id ?? result.application_id ?? null
      setApplicationId(id)
      setApplication(result)
      toast.success(`Application submitted successfully (ID: ${id || '—'})`)
      return result
    } catch (e) {
      const msg = e.message || 'Failed to submit application'
      setError(msg)
      toast.error(msg)
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  // ---------- GET: fetch single application by ID ----------

  const fetchApplication = useCallback(async (id) => {
    if (!id) return null
    setFetching(true)
    setError(null)
    try {
      const response = await api.get(`/api/origination/loanapplication/?id=${id}`)
      // Backend returns { api_code, success, data }
      const data = response.data ?? response
      setApplication(data)
      setApplicationId(data.id ?? id)
      return data
    } catch (e) {
      const msg = e.message || 'Failed to load application'
      setError(msg)
      throw e
    } finally {
      setFetching(false)
    }
  }, [])

  // ---------- helpers ----------

  const clearError = useCallback(() => setError(null), [])
  const clearApplication = useCallback(() => {
    setApplication(null)
    setApplicationId(null)
    setError(null)
  }, [])

  return {
    // submission
    submitApplication,
    submitting,
    error,
    applicationId,
    application,
    // fetching
    fetchApplication,
    fetching,
    // lifecycle helpers
    clearError,
    clearApplication,
  }
}

/**
 * Map the flat form state object to the LoanApplicationSubmitSerializer payload.
 * Only includes fields that have values, so optional fields are omitted when empty.
 */
function mapFormToPayload(formData) {
  if (!formData) return {}

  const payload = {}

  // Identity / personal
  if (formData.nationalId) payload.id_number = formData.nationalId
  if (formData.firstName) payload.first_name = formData.firstName
  if (formData.middleName) payload.middle_name = formData.middleName
  if (formData.lastName) payload.last_name = formData.lastName
  if (formData.email) payload.email = formData.email
  if (formData.phone) payload.phone = formData.phone

  // Address
  if (formData.physical_address) {
    const a = formData.physical_address
    if (a.building_or_premise) payload.building_or_premise = a.building_or_premise
    if (a.unit_or_house_number) payload.unit_or_house_number = a.unit_or_house_number
    if (a.street_or_road_name) payload.street_or_road_name = a.street_or_road_name
    if (a.estate_or_neighborhood) payload.estate_or_neighborhood = a.estate_or_neighborhood
    if (a.sub_county) payload.sub_county = a.sub_county
    if (a.ward) payload.ward = a.ward
    if (a.landmark_school) payload.landmark_school = a.landmark_school
    if (a.landmark_health) payload.landmark_health = a.landmark_health
    if (a.landmark_church) payload.landmark_church = a.landmark_church
  } else {
    // Flat fallback keys
    if (formData.building_or_premise) payload.building_or_premise = formData.building_or_premise
    if (formData.unit_or_house_number) payload.unit_or_house_number = formData.unit_or_house_number
    if (formData.street_or_road_name) payload.street_or_road_name = formData.street_or_road_name
    if (formData.estate_or_neighborhood) payload.estate_or_neighborhood = formData.estate_or_neighborhood
    if (formData.sub_county) payload.sub_county = formData.sub_county
    if (formData.ward) payload.ward = formData.ward
  }

  // Loan
  if (formData.loan_product) payload.loan_product = formData.loan_product
  if (formData.amount_requested !== undefined && formData.amount_requested !== null)
    payload.requested_amount = formData.amount_requested
  if (formData.loan_term !== undefined && formData.loan_term !== null)
    payload.tenure_months = formData.loan_term

  // Employment
  if (formData.employmentStatus) payload.employment_status = formData.employmentStatus
  if (formData.employerName) payload.employer_name = formData.employerName
  if (formData.monthlyIncome !== undefined && formData.monthlyIncome !== null)
    payload.monthly_income = formData.monthlyIncome

  // Documents (files) — include only when present
  if (formData.id_photo_front) payload.id_photo_front = formData.id_photo_front
  if (formData.id_photo_back) payload.id_photo_back = formData.id_photo_back
  if (formData.kra_certificate) payload.kra_certificate = formData.kra_certificate
  if (formData.biometric_photo_1) payload.biometric_photo_1 = formData.biometric_photo_1
  if (formData.payslip) payload.payslip = formData.payslip
  if (formData.mpesa_statement) payload.mpesa_statement = formData.mpesa_statement
  if (formData.bank_statement) payload.bank_statement = formData.bank_statement
  if (formData.utility_bill) payload.utility_bill = formData.utility_bill
  if (formData.proof_of_business) payload.proof_of_business = formData.proof_of_business

  return payload
}