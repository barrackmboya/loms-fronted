// Active loan-product catalogue for the wizard.
//
// GET /api/origination/loan-products/ is the source of truth for min/max
// amount and tenure, product class/segment and the required-document pack.
// A small static catalogue keeps the form usable when the endpoint is
// unavailable; submitting still uses the product *name*, so the backend
// resolves (or rejects) it on create.

import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../../lib/api'

export const FALLBACK_PRODUCTS = [
  { id: 'fallback-quick-salary', name: 'Quick Salary Advance', product_class: 'UNSECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 800000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-personal', name: 'Personal Loan', product_class: 'UNSECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 800000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-salary-advanced', name: 'Salary Advanced', product_class: 'UNSECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 800000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-logbook', name: 'Logbook Loan', product_class: 'SECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 5000000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-car', name: 'Car Loan', product_class: 'SECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 5000000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-home', name: 'Home Loan', product_class: 'SECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 5000000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-education', name: 'Education Loan', product_class: 'UNSECURED', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 800000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-digital', name: 'Digital Loan', product_class: 'REVOLVING', segment: 'IND', currency: 'KES', min_amount: 1000, max_amount: 300000, min_tenure_months: 1, max_tenure_months: 84 },
  { id: 'fallback-trade', name: 'Trade Finance', product_class: 'TRADE', segment: 'SME', currency: 'KES', min_amount: 1000, max_amount: 2000000, min_tenure_months: 1, max_tenure_months: 84 },
]

export function useLoanProducts() {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.loanProducts()
      if (Array.isArray(rows) && rows.length) setProducts(rows)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { products, loading, error, reload: load }
}
