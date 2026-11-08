import { useCallback, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SlidePanel } from './SlidePanel'
import { useLoanApplication } from '../loan-application/hooks/useLoanApplication'
import { PersonalInfoStep } from '../loan-application/steps/PersonalInfo'
import { LoanDetailsStep } from '../loan-application/steps/LoanDetails'
import { DocumentsStep } from '../loan-application/steps/Documents'
import { AddressStep } from '../loan-application/steps/AddressStep'
import { ReviewStep } from '../loan-application/steps/Review'

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

export default function NewApplicationDialog({
  open,
  onOpenChange,
  channel = 'APP',
  onCreated,
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState({ ...INITIAL_FORM })
  const [submitError, setSubmitError] = useState(null)

  const { submitApplication, submitting, error: hookError } = useLoanApplication()

  const isLastStep = stepIndex === STEPS.length - 1
  const currentStep = STEPS[stepIndex]
  const isBusy = submitting

  const nextStep = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1)
  }, [stepIndex])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }, [stepIndex])

  const updateField = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)
    try {
      const payload = { ...formData, channel }
      await submitApplication(payload)
      onOpenChange(false)
      onCreated?.()
    } catch (e) {
      setSubmitError(e.message || 'Failed to submit application')
    }
  }, [formData, channel, submitApplication, onOpenChange, onCreated])

  // Per-step validation for Next gating
  const isStepValid = useCallback(() => {
    switch (currentStep.key) {
      case 'personal':
        return !!formData.firstName && !!formData.nationalId && !!formData.email && !!formData.phone
      case 'loan':
        return !!formData.loan_product && !!formData.amount_requested && !!formData.loan_term && !!formData.purpose
      case 'documents':
        return true // documents are optional
      case 'address': {
        const a = formData.address
        return !!(
          a.county &&
          a.subcounty &&
          a.ward &&
          a.neighborhood &&
          (a.street || a.landmark)
        )
      }
      case 'review':
        return true
      default:
        return true
    }
  }, [currentStep.key, formData])

  const handlePanelClose = () => {
    onOpenChange(false)
  }

  return (
    <SlidePanel
      open={open}
      onClose={handlePanelClose}
      title={`New Application — ${channel}`}
      subtitle="Complete the form to submit a loan application"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Step indicator */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((step, idx) => (
            <div
              key={step.key}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors"
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

        {/* Step content — inline vertical scrollbar within the panel body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          {currentStep.key === 'personal' && (
            <PersonalInfoStep formData={formData} updateField={updateField} />
          )}
          {currentStep.key === 'loan' && (
            <LoanDetailsStep formData={formData} updateField={updateField} />
          )}
          {currentStep.key === 'documents' && (
            <DocumentsStep formData={formData} updateField={updateField} />
          )}
          {currentStep.key === 'address' && (
            <AddressStep formData={formData} updateField={updateField} />
          )}
          {currentStep.key === 'review' && <ReviewStep formData={formData} />}
        </div>

        {/* Submit error */}
        {(submitError || hookError) && (
          <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive">
            {submitError || hookError}
          </div>
        )}

        {/* Navigation footer — pinned at bottom */}
        <div className="flex justify-between items-center pt-6 border-t border-border shrink-0">
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
              disabled={isBusy || !isStepValid()}
              className="btn"
            >
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </SlidePanel>
  )
}
