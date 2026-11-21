// Loan Details step — product, amount, term, purpose and collateral.
// Product bounds/class come from GET /api/origination/loan-products/; the
// backend revalidates them on create (LoanApplicationSerializer.validate).

import { formatCurrency } from '../../../../lib/format'
import { FALLBACK_PRODUCTS } from '../hooks/useLoanProducts'
import { PURPOSES } from '../lib/form'

const inputClass =
  'w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20'

export function LoanDetailsStep({ formData, updateField, products = FALLBACK_PRODUCTS, product }) {
  const options = products?.length ? products : FALLBACK_PRODUCTS
  const selected = product || options.find((p) => p.name === formData.loan_product) || null

  const minAmount = Number(selected?.min_amount ?? 1)
  const maxAmount = Number(selected?.max_amount ?? 0)
  const minTenure = Number(selected?.min_tenure_months ?? 1)
  const maxTenure = Number(selected?.max_tenure_months ?? 84)
  const isSecured = String(selected?.product_class || '').toUpperCase() === 'SECURED'

  const handleProduct = (event) => {
    const next = options.find((p) => String(p.id) === event.target.value) || null
    updateField('loan_product', next?.name || '')
    updateField('loan_product_id', next?.id ?? null)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Loan Product <span className="text-destructive">*</span>
        </label>
        <select
          value={selected ? String(selected.id) : ''}
          onChange={handleProduct}
          className={inputClass}
        >
          <option value="">Select a product</option>
          {options.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5 font-mono uppercase">
              {selected.product_class || 'UNSECURED'}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono uppercase">
              {selected.segment || 'IND'}
            </span>
            <span>
              {formatCurrency(minAmount)} – {formatCurrency(maxAmount)} · {minTenure}–{maxTenure} months
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Amount Requested (KES) <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            value={formData.amount_requested}
            onChange={(e) => updateField('amount_requested', e.target.value)}
            min={minAmount}
            max={maxAmount || undefined}
            step="1000"
            placeholder="e.g. 250000"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Product limits: {formatCurrency(minAmount)} – {formatCurrency(maxAmount)}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Loan Term (months) <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            value={formData.loan_term}
            onChange={(e) => updateField('loan_term', e.target.value)}
            min={minTenure}
            max={maxTenure}
            step="1"
            placeholder="e.g. 24"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Allowed term: {minTenure}–{maxTenure} months
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Purpose <span className="text-destructive">*</span>
        </label>
        <select
          value={formData.purpose || 'PERSONAL'}
          onChange={(e) => updateField('purpose', e.target.value)}
          className={inputClass}
        >
          {PURPOSES.map((purpose) => (
            <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
          ))}
        </select>
      </div>

      {isSecured && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Collateral Value (KES)
          </label>
          <input
            type="number"
            value={formData.collateral_value}
            onChange={(e) => updateField('collateral_value', e.target.value)}
            min="0"
            step="1000"
            placeholder="e.g. 1500000"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Optional at capture. Secured products need a valuation and collateral
            evidence before booking; those are collected by the collateral workflow.
          </p>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800">
          The requested amount and term are validated against the product limits.
          Final limits and pricing are set by credit decisioning.
        </p>
      </div>
    </div>
  )
}
