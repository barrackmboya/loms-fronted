// Income & Declarations step.
//
// Captures employment, the declared affordability inputs (ORG-12 / DEC-05) and
// the income evidence. Values stay as strings while editing and are converted
// to numbers by buildApplicationPayload; the backend stores stated and verified
// income separately.

import { useMemo, useState } from 'react'
import { acceptsFile, isRealFile } from '../../lib/documents'
import { EMPLOYMENT_STATUSES, newDebtRow, requiredDocumentsFor } from '../lib/form'

const inputClass =
  'w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20'

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

const INCOME_DOCS = [
  { key: 'payslip', label: 'Payslip (latest)', docType: 'PAYSLIP' },
  { key: 'bank_statement', label: 'Bank statement (3 months)', docType: 'BANK_STATEMENT' },
  { key: 'mpesa_statement', label: 'M-PESA statement', docType: 'MPESA_STATEMENT' },
]

function MoneyField({ label, value, onChange, required = false, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="100"
        placeholder="0"
        className={inputClass}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function IncomeStep({ formData, updateField, product }) {
  const [fileErrors, setFileErrors] = useState({})
  const status = formData.employment_status || ''
  const required = useMemo(() => requiredDocumentsFor(product), [product])

  const handleFileChange = (key) => (event) => {
    const file = event.target?.files?.[0] || null
    setFileErrors((prev) => ({ ...prev, [key]: null }))
    if (!file) {
      updateField(key, null)
      return
    }
    const check = acceptsFile(file)
    if (!check.ok) {
      setFileErrors((prev) => ({ ...prev, [key]: check.error }))
      if (event.target) event.target.value = ''
      return
    }
    updateField(key, file)
  }

  const handleStatusChange = (event) => {
    const next = event.target.value
    const previous = status
    updateField('employment_status', next)
    if (next !== previous) {
      updateField('employer_name', '')
      updateField('monthly_income', '')
      updateField('payslip_date', '')
    }
  }

  const updateDebtRow = (index, key, value) => {
    const rows = [...(formData.existing_debt_breakdown || [])]
    rows[index] = { ...(rows[index] || newDebtRow()), [key]: value }
    updateField('existing_debt_breakdown', rows)
  }

  const addDebtRow = () => {
    updateField('existing_debt_breakdown', [
      ...(formData.existing_debt_breakdown || []),
      newDebtRow(),
    ])
  }

  const removeDebtRow = (index) => {
    updateField(
      'existing_debt_breakdown',
      (formData.existing_debt_breakdown || []).filter((_, i) => i !== index),
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Employment Status <span className="text-destructive">*</span>
        </label>
        <select value={status} onChange={handleStatusChange} className={inputClass}>
          <option value="">Select employment status</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {!!status && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {NAME_FIELD_LABELS[status]} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.employer_name || ''}
                onChange={(e) => updateField('employer_name', e.target.value)}
                placeholder={NAME_FIELD_PLACEHOLDERS[status]}
                className={inputClass}
              />
            </div>
            <MoneyField
              label="Monthly Income (KES)"
              value={formData.monthly_income}
              onChange={(v) => updateField('monthly_income', v)}
              required
              hint="Stated income. Extraction and statements provide the verified figure."
            />
          </div>

          {status === 'EMPLOYED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Payslip Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={formData.payslip_date || ''}
                  onChange={(e) => updateField('payslip_date', e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Should be within the last 3 months.
                </p>
              </div>
              <label className="flex items-start gap-2 text-xs text-foreground mt-6">
                <input
                  type="checkbox"
                  checked={!!formData.salary_domiciled}
                  onChange={(e) => updateField('salary_domiciled', e.target.checked)}
                  className="mt-0.5"
                />
                <span>Salary is domiciled with the lender (direct salary payment).</span>
              </label>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Income documents</p>
            <div className="space-y-2">
              {INCOME_DOCS.map((doc) => {
                const isRequired = required.includes(doc.docType)
                const file = formData[doc.key]
                return (
                  <div key={doc.key} className="flex flex-col gap-2 p-3 rounded-lg border border-input bg-background sm:flex-row sm:items-center">
                    <span className="flex-shrink-0 text-muted-foreground">📄</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {doc.label}
                        <span className={`ml-2 text-xs font-normal ${isRequired ? 'text-destructive' : 'text-muted-foreground'}`}>
                          ({isRequired ? 'Required' : 'Optional'})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">PDF, JPG, JPEG · max 12 MB</div>
                      {fileErrors[doc.key] && (
                        <div className="text-xs text-destructive mt-1">{fileErrors[doc.key]}</div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-md hover:bg-accent cursor-pointer text-sm text-foreground transition-colors">
                      {isRealFile(file) ? 'Change file' : 'Choose file'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange(doc.key)}
                        className="sr-only"
                      />
                    </label>
                    {isRealFile(file) && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-teal-700 truncate max-w-[10rem]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => updateField(doc.key, null)}
                          className="text-xs text-destructive hover:text-destructive/80"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground mb-1">Declarations</p>
        <p className="text-xs text-muted-foreground mb-3">
          These figures feed affordability (DSR/FOIR/residual income) and fraud reconciliation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyField
            label="Monthly Expenses (KES)"
            value={formData.monthly_expenses}
            onChange={(v) => updateField('monthly_expenses', v)}
            required
          />
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Dependants <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              value={formData.dependents ?? ''}
              onChange={(e) => updateField('dependents', e.target.value)}
              min="0"
              step="1"
              placeholder="0"
              className={inputClass}
            />
          </div>
          <MoneyField
            label="Rent / Housing (KES)"
            value={formData.rent_or_housing}
            onChange={(v) => updateField('rent_or_housing', v)}
            required
          />
          <MoneyField
            label="Other Income (KES)"
            value={formData.other_income}
            onChange={(v) => updateField('other_income', v)}
            required
          />
          <MoneyField
            label="Existing Debt Service (KES / month)"
            value={formData.existing_debt_service}
            onChange={(v) => updateField('existing_debt_service', v)}
            required
            hint="Total monthly repayments on other loans and obligations."
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Existing debt breakdown</p>
            <button type="button" onClick={addDebtRow} className="text-xs text-teal-700 hover:underline">
              + Add debt
            </button>
          </div>
          {(formData.existing_debt_breakdown || []).length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No other debts declared. Add a row per lender / facility if any.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {(formData.existing_debt_breakdown || []).map((row, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      value={row.type || ''}
                      onChange={(e) => updateDebtRow(index, 'type', e.target.value)}
                      placeholder="Type (e.g. car loan)"
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      value={row.lender || ''}
                      onChange={(e) => updateDebtRow(index, 'lender', e.target.value)}
                      placeholder="Lender"
                      className={inputClass}
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={row.monthly_amount ?? ''}
                    onChange={(e) => updateDebtRow(index, 'monthly_amount', e.target.value)}
                    placeholder="Monthly"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="0"
                    value={row.outstanding_balance ?? ''}
                    onChange={(e) => updateDebtRow(index, 'outstanding_balance', e.target.value)}
                    placeholder="Outstanding"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeDebtRow(index)}
                    className="text-xs text-destructive hover:text-destructive/80 py-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
