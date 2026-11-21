// ApplyPage — standalone multi-step loan application form.
// Shares the dialog's form contract (lib/form.js) so both entry points submit
// exactly the same payload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { useLoanApplication } from './hooks/useLoanApplication'
import { useLoanProducts } from './hooks/useLoanProducts'
import { PersonalInfoStep } from './steps/PersonalInfo'
import { LoanDetailsStep } from './steps/LoanDetails'
import { DocumentsStep } from './steps/Documents'
import { AddressStep } from './steps/AddressStep'
import { IncomeStep } from './steps/IncomeStep'
import { ReviewStep } from './steps/Review'
import {
  STEPS,
  createInitialForm,
  requiredDocumentsFor,
  selectedProduct,
  validateApplication,
  validateStep,
} from './lib/form'

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ApplyPage({ onBack }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState(createInitialForm)
  const [submitError, setSubmitError] = useState(null)
  const idempotencyKeyRef = useRef(newIdempotencyKey())

  const { submitApplicationMultipart, submitting, error: hookError } = useLoanApplication()
  const { products, error: productsError } = useLoanProducts()

  const currentStep = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1
  const product = useMemo(() => selectedProduct(products, formData), [products, formData])
  const required = useMemo(() => requiredDocumentsFor(product), [product])
  const stepErrors = useMemo(
    () => validateStep(currentStep.key, formData, { product }),
    [currentStep.key, formData, product],
  )
  const allErrors = useMemo(
    () => validateApplication(formData, { product }),
    [formData, product],
  )

  const nextStep = useCallback(() => {
    if (stepErrors.length || stepIndex >= STEPS.length - 1) return
    setStepIndex((i) => i + 1)
  }, [stepErrors.length, stepIndex])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }, [stepIndex])

  const updateField = useCallback((key, value) => {
    setFormData((prev) => {
      const newValue = typeof value === 'function' ? value(prev[key]) : value
      return { ...prev, [key]: newValue }
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)
    if (allErrors.length) {
      setSubmitError(allErrors.slice(0, 5).join(' '))
      return
    }
    try {
      await submitApplicationMultipart(formData, {
        channel: 'APP',
        idempotencyKey: idempotencyKeyRef.current,
      })
      idempotencyKeyRef.current = newIdempotencyKey()
      onBack()
    } catch (e) {
      setSubmitError(e.message || 'Failed to submit application')
    }
  }, [allErrors, formData, submitApplicationMultipart, onBack])

  // Keep the page title in sync with the rest of the app.
  useEffect(() => {
    document.title = 'New Loan Application'
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </button>
      </div>

      <div className="border-b border-border pb-4 mb-6">
        <h1 className="text-2xl font-semibold text-foreground">New Loan Application</h1>
        <p className="text-sm text-muted-foreground">
          Complete the form to submit a loan application
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
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

      <div className="space-y-6">
        {currentStep.key === 'personal' && (
          <PersonalInfoStep formData={formData} updateField={updateField} />
        )}
        {currentStep.key === 'loan' && (
          <LoanDetailsStep formData={formData} updateField={updateField} products={products} product={product} />
        )}
        {currentStep.key === 'documents' && (
          <DocumentsStep formData={formData} updateField={updateField} product={product} required={required} />
        )}
        {currentStep.key === 'income' && (
          <IncomeStep formData={formData} updateField={updateField} product={product} />
        )}
        {currentStep.key === 'address' && (
          <AddressStep formData={formData} updateField={updateField} />
        )}
        {currentStep.key === 'review' && (
          <ReviewStep formData={formData} updateField={updateField} product={product} required={required} />
        )}
      </div>

      {productsError && (
        <div className="p-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800">
          Could not load the product catalogue — showing the default catalogue. {productsError.message}
        </div>
      )}

      {stepErrors.length > 0 && !isLastStep && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <AlertCircle className="h-3.5 w-3.5" /> Complete this step to continue
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {stepErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}
      {(submitError || hookError) && (
        <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          {submitError || hookError}
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t border-border">
        {stepIndex > 0 ? (
          <button onClick={prevStep} disabled={submitting} className="btn ghost whitespace-nowrap">
            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
          </button>
        ) : null}

        <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          Step {stepIndex + 1} of {STEPS.length}
        </div>

        {isLastStep ? (
          <button onClick={handleSubmit} disabled={submitting || allErrors.length > 0} className="btn">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        ) : (
          <button onClick={nextStep} disabled={submitting || stepErrors.length > 0} className="btn">
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </button>
        )}
      </div>
    </div>
  )
}
