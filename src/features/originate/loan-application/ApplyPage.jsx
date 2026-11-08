// ApplyPage — multi-step loan application form.
// Integrated into OriginatePage via the ?action=apply URL query param.
// Uses the existing useUrlState hook and useLoanApplication hook — no react-router-dom.

import { useCallback, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useLoanApplication } from './hooks/useLoanApplication'
import { PersonalInfoStep } from './steps/PersonalInfo'
import { LoanDetailsStep } from './steps/LoanDetails'
import { DocumentsStep } from './steps/Documents'
import { AddressStep } from './steps/AddressStep'
import { ReviewStep } from './steps/Review'

const STEPS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'loan', label: 'Loan Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'address', label: 'Address' },
  { key: 'review', label: 'Review & Submit' },
]

const INITIAL_FORM = {
  firstName: '',
  nationalId: '',
  email: '',
  phone: '',
  loan_product: 'PERSONAL_LOAN',
  amount_requested: '',
  loan_term: '',
  purpose: '',
  id_photo_front: null,
  payslip: null,
  bank_statement: null,
  address: {
    county: null,
    subcounty: null,
    ward: null,
    neighborhood: null,
    street: null,
    landmark: null,
    lat: null,
    lng: null,
    plot_number: '',
    postal_code: '',
  },
}

export function ApplyPage({ onBack }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState({ ...INITIAL_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const { submitApplication, submitting: hookSubmitting, error: hookError } = useLoanApplication()

  const isLastStep = stepIndex === STEPS.length - 1
  const currentStep = STEPS[stepIndex]
  const isBusy = submitting || hookSubmitting

  const nextStep = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1)
  }, [stepIndex])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }, [stepIndex])

  const updateField = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setSubmitError(null)
      try {
        await submitApplication(formData)
        onBack()
      } catch (e) {
        setSubmitError(e.message || 'Failed to submit application')
      }
    },
    [formData, submitApplication, onBack]
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* Back to applications link */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </button>
      </div>

      {/* Header */}
      <div className="border-b border-border pb-4 mb-6">
        <h1 className="text-2xl font-semibold text-foreground">New Loan Application</h1>
        <p className="text-sm text-muted-foreground">
          Complete the form to submit a loan application
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((step, idx) => (
          <div
            key={step.key}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors border"
            style={{
              backgroundColor:
                idx < stepIndex
                  ? 'rgba(23, 107, 99, 0.1)'
                  : idx === stepIndex
                  ? 'var(--teal)'
                  : 'rgba(235, 245, 244, 0.6)',
              color: idx === stepIndex ? '#ffffff' : idx < stepIndex ? '#0f766e' : '#6b7280',
              borderColor:
                idx < stepIndex
                  ? 'rgba(23, 107, 99, 0.2)'
                  : idx === stepIndex
                  ? 'var(--teal)'
                  : 'transparent',
            }}
          >
            <span className="font-mono">{idx + 1}</span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="space-y-6">
        {currentStep.key === 'personal' && (
          <PersonalInfoStep formData={formData} updateField={updateField} />
        )}
        {currentStep.key === 'loan' && <LoanDetailsStep formData={formData} updateField={updateField} />}
        {currentStep.key === 'documents' && (
          <DocumentsStep formData={formData} updateField={updateField} />
        )}
        {currentStep.key === 'review' && <ReviewStep formData={formData} />}
      </div>

      {/* Submit error */}
      {(submitError || hookError) && (
        <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          {submitError || hookError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-border">
        {stepIndex > 0 ? (
          <button
            onClick={prevStep}
            disabled={isBusy}
            className="btn ghost whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
          </button>
        ) : null}

        <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          Step {stepIndex + 1} of {STEPS.length}
        </div>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className="btn"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={isBusy}
            className="btn"
          >
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </button>
        )}
      </div>
    </div>
  )
}
