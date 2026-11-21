// Loan application hook — consumes POST/GET /api/origination/loanapplication/
// and GET /api/applications/<id>.
//
// The wizard state is snake_case (see ../lib/form.js). This hook builds the
// canonical flat payload, converts the liveness data URLs into the three
// biometric files the backend expects, and sends multipart with an
// Idempotency-Key so a retried submit cannot duplicate the application.

import { useCallback, useState } from 'react'
import { api } from '../../../../lib/api'
import { toast } from '../../../../components/ui/sonner'
import { buildApplicationPayload } from '../lib/form'

const isFile = (value) =>
  typeof File !== 'undefined' && value instanceof File

async function dataUrlToFile(dataUrl, filename) {
  if (!dataUrl) return null
  if (isFile(dataUrl)) return dataUrl
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null

  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) return null
  const [, mime, base64] = match
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], filename, { type: mime || 'image/jpeg' })
  } catch {
    return null
  }
}

function appendPayload(formData, payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue
    if (isFile(value)) {
      formData.append(key, value)
    } else if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
}

async function withBiometrics(payload, formData) {
  const photos = formData?.personal?.photos || {}
  const files = await Promise.all([
    dataUrlToFile(photos.front, 'liveness-front.jpg'),
    dataUrlToFile(photos.left, 'liveness-left.jpg'),
    dataUrlToFile(photos.right, 'liveness-right.jpg'),
  ])
  files.forEach((file, index) => {
    if (file) payload[`biometric_photo_${index + 1}`] = file
  })
  return payload
}

export function useLoanApplication() {
  const [submitting, setSubmitting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState(null)
  const [application, setApplication] = useState(null)
  const [applicationId, setApplicationId] = useState(null)
  const [reference, setReference] = useState(null)

  // ---------- POST: create application (JSON, file-less fallback) ----------

  const submitApplication = useCallback(async (wizardState, options = {}) => {
    setSubmitting(true)
    setError(null)
    setApplicationId(null)
    setReference(null)

    try {
      const payload = buildApplicationPayload(wizardState, options)
      const jsonPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => !isFile(value)),
      )
      const result = await api.post('/api/origination/loanapplication/', jsonPayload)
      const id = result.application_id ?? result.id ?? null
      setApplicationId(id)
      setReference(result.reference ?? null)
      setApplication(result)
      toast.success(
        result.reference
          ? `Application ${result.reference} submitted`
          : `Application submitted successfully (ID: ${id || '—'})`,
      )
      return result
    } catch (e) {
      const msg = e.message || 'Failed to submit application'
      setError(msg)
      toast.error(msg)
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  // ---------- POST: create application (multipart) ----------

  const submitApplicationMultipart = useCallback(async (wizardState, options = {}) => {
    const { channel = 'APP', idempotencyKey } = options
    setSubmitting(true)
    setError(null)
    setApplicationId(null)
    setReference(null)

    try {
      const payload = await withBiometrics(
        buildApplicationPayload(wizardState, { channel }),
        wizardState,
      )

      const body = new FormData()
      appendPayload(body, payload)

      const result = await api.postMultipart(
        '/api/origination/loanapplication/',
        body,
        { idempotencyKey },
      )

      const id = result.application_id ?? result.id ?? null
      setApplicationId(id)
      setReference(result.reference ?? null)
      setApplication(result)
      toast.success(
        result.reference
          ? `Application ${result.reference} submitted (status: ${result.status || '—'})`
          : `Application submitted successfully (ID: ${id || '—'})`,
      )
      return result
    } catch (e) {
      const msg = e.message || 'Failed to submit application'
      setError(msg)
      toast.error(msg)
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  // ---------- GET: fetch a single application ----------

  const fetchApplication = useCallback(async (id) => {
    if (!id) return null
    setFetching(true)
    setError(null)
    try {
      const data = await api.retrieveApplication(id)
      setApplication(data)
      setApplicationId(data.id ?? id)
      setReference(data.reference ?? null)
      return data
    } catch (e) {
      const msg = e.message || 'Failed to load application'
      setError(msg)
      throw e
    } finally {
      setFetching(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])
  const clearApplication = useCallback(() => {
    setApplication(null)
    setApplicationId(null)
    setReference(null)
    setError(null)
  }, [])

  return {
    submitApplication,
    submitApplicationMultipart,
    submitting,
    error,
    applicationId,
    reference,
    application,
    fetchApplication,
    fetching,
    clearError,
    clearApplication,
  }
}
