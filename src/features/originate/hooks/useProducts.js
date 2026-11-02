// Products hook (Phase 2).
// Derives product names from loaded applications data.
// No dedicated products endpoint exists.

import { useMemo } from 'react'

export function useProducts(applications) {
  return useMemo(() => {
    if (!applications || !applications.length) return []

    const productSet = new Set()
    applications.forEach((app) => {
      if (app.product) productSet.add(app.product)
    })

    // Return sorted array of product names
    return Array.from(productSet).sort()
  }, [applications])
}