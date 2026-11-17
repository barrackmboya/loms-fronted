// Personal Info step — step 1 of the loan application form.
// Field names match useLoanApplication's mapFormToPayload.
import LivenessStep from './LivenessStep'

export function PersonalInfoStep({ formData, updateField }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">First Name</label>
          <input
            type="text"
            value={formData.first_name || ''}
            onChange={(e) => updateField('first_name', e.target.value)}
            placeholder="e.g. Amara"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Last Name</label>
          <input
            type="text"
            value={formData.last_name || ''}
            onChange={(e) => updateField('last_name', e.target.value)}
            placeholder="e.g. Okoye"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Other Names</label>
          <input
            type="text"
            value={formData.other_names || ''}
            onChange={(e) => updateField('other_names', e.target.value)}
            placeholder="e.g. Elizabeth"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">National ID Number</label>
          <input
            type="text"
            value={formData.nationalId || ''}
            onChange={(e) => updateField('nationalId', e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Email</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="e.g. amara@example.com"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Phone Number</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="e.g. 0712345678"
            className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Liveness section */}
      <LivenessStep formData={formData} updateField={updateField} />
    </div>
  )
}
