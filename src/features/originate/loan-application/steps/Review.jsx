// Review & Submit — read the canonical form state back to the operator,
// show the product's document-pack status, and capture the declarations and
// consents the backend records on the application (ORG-12 / ORG-15).

import { packChecklist, missingPack } from '../../lib/documents'
import {
  CONSENTS,
  EMPLOYMENT_STATUSES,
  ID_TYPES,
  formatFullName,
  requiredDocumentsFor,
} from '../lib/form'

const EMPLOYMENT_LABELS = Object.fromEntries(
  EMPLOYMENT_STATUSES.map((s) => [s.value, s.label]),
)
const ID_TYPE_LABELS = Object.fromEntries(ID_TYPES.map((t) => [t.value, t.label]))
const PURPOSE_LABELS = {
  PERSONAL: 'Personal / household',
  BUSINESS: 'Business working capital',
  EDUCATION: 'Education',
  MEDICAL: 'Medical',
  HOME_IMPROVEMENT: 'Home improvement',
  DEBT_CONSOLIDATION: 'Debt consolidation',
  VEHICLE: 'Vehicle purchase',
  OTHER: 'Other',
}

const money = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && value !== '' && value != null ? `KES ${n.toLocaleString()}` : '—'
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value || '—'}</span>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-accent/40 p-3 rounded-lg border border-border">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
      <div className="text-sm text-foreground space-y-1">{children}</div>
    </div>
  )
}

export function ReviewStep({ formData, updateField, product, required: requiredOverride }) {
  const required = (requiredOverride?.length
    ? requiredOverride
    : requiredDocumentsFor(product)
  ).filter((d) => String(d).toUpperCase() !== 'COLLATERAL')

  const checklist = packChecklist(formData, required)
  const missing = missingPack(formData, required)
  const photos = formData.personal?.photos || {}
  const livenessComplete = !!(photos.front && photos.left && photos.right)
  const a = formData.address || {}

  const toggleConsent = (key, checked) => {
    updateField('consents', (prev = {}) => ({ ...prev, [key]: checked }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Applicant">
          <Row label="Full name" value={formatFullName(formData)} />
          <Row label="ID type" value={ID_TYPE_LABELS[formData.id_type] || formData.id_type} />
          <Row label="ID number" value={formData.id_number} />
          <Row label="Date of birth" value={formData.date_of_birth} />
          <Row label="Email" value={formData.email} />
          <Row label="Phone" value={formData.phone} />
        </Card>

        <Card title="Loan request">
          <Row label="Product" value={formData.loan_product} />
          <Row label="Amount" value={money(formData.amount_requested)} />
          <Row label="Term" value={formData.loan_term ? `${formData.loan_term} months` : '—'} />
          <Row label="Purpose" value={PURPOSE_LABELS[formData.purpose] || formData.purpose} />
          {String(product?.product_class || '').toUpperCase() === 'SECURED' && (
            <Row label="Collateral value" value={money(formData.collateral_value)} />
          )}
        </Card>
      </div>

      <Card title="Income & declarations">
        <Row label="Employment" value={EMPLOYMENT_LABELS[formData.employment_status]} />
        <Row label="Employer / business" value={formData.employer_name} />
        <Row label="Monthly income" value={money(formData.monthly_income)} />
        <Row label="Monthly expenses" value={money(formData.monthly_expenses)} />
        <Row label="Dependants" value={formData.dependents === '' ? '—' : String(formData.dependents)} />
        <Row label="Rent / housing" value={money(formData.rent_or_housing)} />
        <Row label="Other income" value={money(formData.other_income)} />
        <Row label="Existing debt service" value={money(formData.existing_debt_service)} />
        <Row
          label="Salary domiciled"
          value={formData.salary_domiciled ? 'Yes' : 'No'}
        />
        {(formData.existing_debt_breakdown || []).length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground mb-1">Other debts</p>
            <ul className="space-y-0.5">
              {formData.existing_debt_breakdown.map((row, i) => (
                <li key={i} className="flex justify-between gap-3 text-xs">
                  <span>
                    {[row.type, row.lender].filter(Boolean).join(' · ') || 'Debt'}
                  </span>
                  <span className="font-mono">{money(row.monthly_amount)}/mo</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Document pack">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {checklist.map((item) => (
            <li key={item.docType} className="flex items-center gap-2 text-xs">
              <span className={item.uploaded ? 'text-teal-600' : 'text-muted-foreground'}>
                {item.uploaded ? '✓' : '○'}
              </span>
              <span className={item.uploaded ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <p className="text-xs text-amber-800 mt-2">
            Missing: {missing.join(', ')}. The application can be submitted, but the document gate
            will keep it at DOC_PENDING.
          </p>
        )}
        <p className={`text-xs mt-2 ${livenessComplete ? 'text-teal-700' : 'text-muted-foreground'}`}>
          Liveness photos: {livenessComplete ? 'captured (3 angles)' : 'not captured — recommended before KYC'}
        </p>
      </Card>

      <Card title="Address">
        <Row label="County" value={a.county?.name || a.county} />
        <Row label="Sub-county" value={a.subcounty?.name || a.subcounty} />
        <Row label="Ward" value={a.ward?.name || a.ward} />
        <Row label="Neighbourhood" value={a.neighborhood?.name || a.neighborhood} />
        <Row label="Street / landmarks" value={[a.street?.name, ...(a.landmarks || []).map((l) => l.name)].filter(Boolean).join(', ')} />
        <Row label="House / plot" value={a.plot_number} />
        <Row label="Postal code" value={a.postal_code} />
      </Card>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Consents</p>
        {CONSENTS.map((consent) => (
          <label key={consent.key} className="flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={!!formData.consents?.[consent.key]}
              onChange={(e) => toggleConsent(consent.key, e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{consent.label}</span>
              <span className="block text-muted-foreground">{consent.description}</span>
            </span>
          </label>
        ))}

        <label className="flex items-start gap-2 text-xs text-foreground border-t border-border pt-3">
          <input
            type="checkbox"
            checked={!!formData.sanctions_screened}
            onChange={(e) => updateField('sanctions_screened', e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Sanctions / PEP screening completed</span>
            <span className="block text-muted-foreground">
              I confirm the applicant was screened against the approved sanctions and PEP lists and
              no match was found. This is recorded as a KYC fact.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-xs text-foreground border-t border-border pt-3">
          <input
            type="checkbox"
            checked={!!formData.declarations_accepted}
            onChange={(e) => updateField('declarations_accepted', e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Declaration accepted</span>
            <span className="block text-muted-foreground">
              The information and declarations above are complete and accurate. I understand that
              false information may lead to decline or recovery action.
            </span>
          </span>
        </label>
      </div>

      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
        <p className="text-sm text-amber-800">
          Review your details carefully before submitting. The document pack and KYC gates are
          evaluated by the backend immediately after submit.
        </p>
      </div>
    </div>
  )
}
