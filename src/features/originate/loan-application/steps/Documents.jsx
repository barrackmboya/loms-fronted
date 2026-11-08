// Documents step — step 3 of the loan application form.
// Field names match useLoanApplication's mapFormToPayload.

export function DocumentsStep({ formData, updateField }) {
  const handleFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null
    updateField(key, file)
  }

  const DOCS = [
    { key: 'id_photo_front', label: 'National ID Photo', accept: '.jpg,.jpeg,.png' },
    { key: 'payslip', label: 'Payslip (latest)', accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'bank_statement', label: 'Bank Statement (3 months)', accept: '.pdf,.jpg,.jpeg,.png' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload supporting documents for your application.
      </p>
      <div className="space-y-3">
        {DOCS.map((doc) => {
          const hasFile = !!formData[doc.key]
          return (
            <div key={doc.key} className="flex items-center gap-3 p-3 rounded-lg border border-input bg-background">
              <span className="flex-shrink-0 text-muted-foreground">📄</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{doc.label}</div>
                <div className="text-xs text-muted-foreground">{doc.accept}</div>
              </div>
              <label className="ml-4 flex items-center gap-2 px-3 py-1.5 border border-input rounded-md hover:bg-accent cursor-pointer text-sm text-foreground transition-colors">
                {hasFile ? 'Change file' : 'Choose file'}
                <input
                  type="file"
                  accept={doc.accept}
                  onChange={handleFileChange(doc.key)}
                  className="sr-only"
                />
              </label>
              {hasFile && (
                <span className="text-xs text-teal-600 flex items-center gap-1 ml-2">
                  {formData[doc.key].name}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
