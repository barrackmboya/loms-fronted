// useKycReport.js — loads the KYC report for a LoanApplication from
// GET /api/origination/reports/kyc/?id=<applicationId> and maps it to the
// view model rendered by ViewApplicationContent.jsx (mapKycReport).
//
// Returns { report, loading, error, reload } — `report` is null until the
// fetch succeeds; `reload` re-requests with the same applicationId (Retry).

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { mapKycReport } from '../lib/mappers'

export function useKycReport(applicationId) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Guards against out-of-order responses when applicationId changes quickly.
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    if (applicationId == null) return
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    try {
      const response = await api.kycReport(applicationId)
      if (seq !== requestSeq.current) return // superseded by a newer request
      const mapped = mapKycReport(response?.data)
      if (!mapped) throw new Error('KYC report returned no data.')
      setReport(mapped)
    } catch (e) {
      if (seq !== requestSeq.current) return
      setError(e)
      setReport(null)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    setReport(null)
    setError(null)
    load()
  }, [load])

  return { report, loading, error, reload: load }
}
