// Loan Details step — step 2 of the loan application form.
// Field names match useLoanApplication's mapFormToPayload.

export function LoanDetailsStep({ formData, updateField }) {
  const PRODUCTS = [
    { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
    { value: 'BUSINESS_LOAN', label: 'Business Loan' },
    { value: 'SALARY_ADVANCE', label: 'Salary Advance' },
    { value: 'LOGBOOK_LOAN', label: 'Logbook Loan' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Loan Product</label>
        <select
          value={formData.loan_product}
          onChange={(e) => updateField('loan_product', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Amount Requested (KES)</label>
          <input
            type="number"
            value={formData.amount_requested}
            onChange={(e) => updateField('amount_requested', e.target.value)}
            min="0"
            step="1000"
            placeholder="e.g. 250000"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Loan Term (months)</label>
          <input
            type="number"
            value={formData.loan_term}
            onChange={(e) => updateField('loan_term', e.target.value)}
            min="1"
            step="1"
            placeholder="e.g. 24"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Purpose</label>
        <textarea
          value={formData.purpose}
          onChange={(e) => updateField('purpose', e.target.value)}
          rows={3}
          placeholder="e.g. Working capital for inventory"
          className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-start gap-3">
          <span className="h-5 w-5 text-blue-600 mt-0.5">📋</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium">Loan amount and term will be assessed during credit decisioning.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
