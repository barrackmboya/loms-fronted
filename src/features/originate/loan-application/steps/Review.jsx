// Review step — step 4 of the loan application form.
// Field names match useLoanApplication's mapFormToPayload.

export function ReviewStep({ formData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Full Name</div>
          <div className="text-sm text-foreground">{formData.firstName || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">National ID</div>
          <div className="text-sm text-foreground">{formData.nationalId || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</div>
          <div className="text-sm text-foreground">{formData.email || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</div>
          <div className="text-sm text-foreground">{formData.phone || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Loan Product</div>
          <div className="text-sm text-foreground capitalize">{formData.loan_product || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount (KES)</div>
          <div className="text-sm text-foreground">{formData.amount_requested || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Term (months)</div>
          <div className="text-sm text-foreground">{formData.loan_term || '—'}</div>
        </div>
        <div className="bg-accent/40 p-3 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Purpose</div>
          <div className="text-sm text-foreground">{formData.purpose || '—'}</div>
        </div>
      </div>

      <div className="bg-accent/40 p-3 rounded-lg border border-border">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Documents</div>
        <ul className="text-sm text-foreground space-y-1">
          {['id_photo_front', 'payslip', 'bank_statement'].map((key) => (
            <li key={key} className="flex items-center gap-2">
              {formData[key] ? (
                <>
                  <span className="text-teal-600">✓</span>
                  <span>{formData[key].name}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">Not uploaded</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-accent/40 p-3 rounded-lg border border-border">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Address</div>
        <div className="text-sm text-foreground space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">County</span>
            <span>{formData.address?.county?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sub-County</span>
            <span>{formData.address?.subcounty?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ward</span>
            <span>{formData.address?.ward?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neighborhood</span>
            <span>{formData.address?.neighborhood?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Street / Landmark</span>
            <span>
              {formData.address?.street?.name || formData.address?.landmark?.name || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plot Number</span>
            <span>{formData.address?.plot_number || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Postal Code</span>
            <span>{formData.address?.postal_code || '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
        <p className="text-sm text-amber-800">
          Review your details carefully before submitting. Once submitted, the application will be
          processed through credit decisioning.
        </p>
      </div>
    </div>
  )
}
