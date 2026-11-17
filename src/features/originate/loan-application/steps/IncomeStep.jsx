// Income step — employment status and income document uploads.
// Field names match useLoanApplication's mapFormToPayload.
// Employment statuses match the backend EmploymentStatus TextChoices.

import { useState } from 'react'

const EMPLOYMENT_STATUSES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED_PROFESSIONAL', label: 'Self-Employed Professional' },
  { value: 'SELF_EMPLOYED_BUSINESS', label: 'Self Employed Business Owner' },
]

const NAME_FIELD_LABELS = {
  EMPLOYED: 'Employer Name',
  SELF_EMPLOYED_PROFESSIONAL: 'Occupation',
  SELF_EMPLOYED_BUSINESS: 'Business Name',
}

const NAME_FIELD_PLACEHOLDERS = {
  EMPLOYED: 'e.g. Tech Solutions Ltd',
  SELF_EMPLOYED_PROFESSIONAL: 'e.g. Software Developer',
  SELF_EMPLOYED_BUSINESS: 'e.g. Amara Enterprises',
}

const DOCS_BY_STATUS = {
  EMPLOYED: [
    { key: 'payslip', label: 'Payslip (latest)', required: true },
    { key: 'bank_statement', label: 'Bank Statement (3 months)', required: true },
    { key: 'mpesa_statement', label: 'M-Pesa Statement', required: true },
  ],
  SELF_EMPLOYED_PROFESSIONAL: [
    { key: 'bank_statement', label: 'Bank Statement (3 months)', required: false },
    { key: 'mpesa_statement', label: 'M-Pesa Statement', required: true },
  ],
  SELF_EMPLOYED_BUSINESS: [
    { key: 'bank_statement', label: 'Bank Statement (3 months)', required: false },
    { key: 'mpesa_statement', label: 'M-Pesa Statement', required: true },
  ],
}

export function IncomeStep({ formData, updateField }) {
  const [fileErrors, setFileErrors] = useState({})
  const [fileHashes, setFileHashes] = useState({})

  const status = formData.employmentStatus || ''
  const incomeDocs = DOCS_BY_STATUS[status] || []
  const nameFieldLabel = NAME_FIELD_LABELS[status]

  const handleFileChange = (key) => async (e) => {
    const file = e.target.files?.[0] || null
    if (file) {
      const ext = `.${file.name.split('.').pop().toLowerCase()}`
      if (!['.pdf', '.jpg', '.jpeg'].includes(ext)) {
        setFileErrors((prev) => ({ ...prev, [key]: 'Only PDF and JPEG files are accepted.' }))
        return
      }
      if (file.size > 12 * 1024 * 1024) {
        setFileErrors((prev) => ({ ...prev, [key]: 'File exceeds 12 MB limit.' }))
        return
      }
      const hash = await computeFileHash(file)
      setFileHashes((prev) => ({ ...prev, [key]: hash }))
    } else {
      setFileErrors((prev) => {
        const { [key]: _, ...rest } = prev
        return rest
      })
    }
    setFileErrors((prev) => ({ ...prev, [key]: null }))
    updateField(key, file)
  }

  const computeFileHash = async (file) => {
    const buffer = await file.arrayBuffer()
    // Web Crypto API may not be available in all environments (e.g. jsdom tests).
    // Fall back to a simple hash based on file metadata when subtle is undefined.
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      const hashArray = Array.from(new Uint8Array(buffer)).slice(0, 32)
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    const hashBytes = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBytes))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  const isPayslipRecent = (dateString) => {
    const payslipDate = new Date(dateString)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    return payslipDate >= threeMonthsAgo
  }

  const handleFileView = (file) => {
    const url = URL.createObjectURL(file)
    window.open(url, '_blank')
  }

  const handleStatusChange = (e) => {
    const newStatus = e.target.value
    const previousStatus = status
    updateField('employmentStatus', newStatus)
    // The name field label changes per status — reset stale values.
    if (newStatus !== previousStatus) {
      updateField('employerName', '')
      updateField('monthlyIncome', null)
    }
    // Drop documents that don't apply to the newly selected status (e.g. payslip).
    const previousDocKeys = (DOCS_BY_STATUS[previousStatus] || []).map((d) => d.key)
    const newDocKeys = (DOCS_BY_STATUS[newStatus] || []).map((d) => d.key)
    previousDocKeys
      .filter((key) => !newDocKeys.includes(key))
      .forEach((key) => updateField(key, null))
    if (newStatus !== 'EMPLOYED') updateField('payslipDate', null)
  }

  const missingRequiredDocs = incomeDocs.filter((doc) => doc.required && !formData[doc.key])
  const nameFieldMissing = !!nameFieldLabel && !formData.employerName
  const allMandatoryMet = !nameFieldMissing && missingRequiredDocs.length === 0

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Employment Status <span className="text-destructive">*</span>
        </label>
        <select
          value={status}
          onChange={handleStatusChange}
          className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          <option value="">Select employment status</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {!!status && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {nameFieldLabel} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.employerName || ''}
              onChange={(e) => updateField('employerName', e.target.value)}
              placeholder={NAME_FIELD_PLACEHOLDERS[status]}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Monthly Income (KES) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              value={formData.monthlyIncome || ''}
              onChange={(e) =>
                updateField('monthlyIncome', e.target.value ? Number(e.target.value) : null)
              }
              min="0"
              step="1000"
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
      )}

      {status === 'EMPLOYED' && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Payslip Date <span className="text-destructive">*</span>
          </label>
          <input
            type="date"
            value={formData.payslipDate || ''}
            onChange={(e) => updateField('payslipDate', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Date shown on your payslip (used to check recency — should be within the last 3 months).
          </p>
        </div>
      )}

      {!!status && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Income Documents <span className="text-destructive">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Upload the required documents for your employment status (PDF or JPEG).
          </p>
          <div className="space-y-3">
            {incomeDocs.map((doc) => {
              const hasFile = !!formData[doc.key]
              const fileError = fileErrors[doc.key]
              return (
                <div key={doc.key} className="flex items-center gap-3 p-3 rounded-lg border border-input bg-background">
                  <span className="flex-shrink-0 text-muted-foreground">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {doc.label}
                      <span className={`ml-2 text-xs font-normal ${doc.required ? 'text-destructive' : 'text-muted-foreground'}`}>
                        ({doc.required ? 'Required' : 'Optional'})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">PDF, JPG, JPEG</div>
                    {fileError && (
                      <div className="text-xs text-destructive mt-1">{fileError}</div>
                    )}
                  </div>
                  <label
                    className="ml-4 flex items-center gap-2 px-3 py-1.5 border border-input rounded-md hover:bg-accent cursor-pointer text-sm text-foreground transition-colors"
                  >
                    {hasFile ? 'Change file' : 'Choose file'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg"
                      onChange={handleFileChange(doc.key)}
                      className="sr-only"
                    />
                  </label>
                  {hasFile && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-teal-600">{formData[doc.key].name}</span>
                      <button
                        type="button"
                        onClick={() => handleFileView(formData[doc.key])}
                        className="text-xs text-teal-600 hover:text-teal-600/80 underline underline-offset-4"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(doc.key, null)}
                        className="text-xs text-destructive hover:text-destructive/80"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {status === 'EMPLOYED' && formData.payslip && (
        <div className="space-y-2">
          {formData.employerName && (
            <div className="p-2 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-800">
                Please confirm the employer name on your payslip matches
                <span className="font-medium">{formData.employerName}</span>.
              </p>
            </div>
          )}
          {formData.monthlyIncome && (
            <div className="p-2 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-800">
                Please confirm the income on your payslip matches KES{' '}
                <span className="font-medium">{Number(formData.monthlyIncome).toLocaleString()}</span> per month.
              </p>
            </div>
          )}
          {formData.payslipDate && (
            <div className="p-2 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-800">
                Payslip date: {formData.payslipDate}{' '}
                {isPayslipRecent(formData.payslipDate) ? (
                  <span className="font-medium">(within 3 months)</span>
                ) : (
                  <span className="font-medium">(more than 3 months old — may affect verification)</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {!!status && (
        <div
          className={`p-2 rounded-lg border ${
            allMandatoryMet
              ? 'border-teal-500/20 bg-teal-50/5'
              : 'border-destructive/20 bg-destructive/5'
          }`}
        >
          {allMandatoryMet ? (
            <p className="text-xs text-teal-700">All required information provided.</p>
          ) : (
            <p className="text-xs text-destructive">
              {nameFieldMissing && `${nameFieldLabel} is required.`}{' '}
              {missingRequiredDocs.length > 0 &&
                `Please upload: ${missingRequiredDocs.map((d) => d.label).join(', ')}.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
