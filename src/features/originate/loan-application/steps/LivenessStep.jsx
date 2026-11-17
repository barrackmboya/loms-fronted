// LivenessStep.jsx
// Drop-in component for PersonalInfo.jsx
// Usage: <LivenessStep formData={formData} updateField={updateField} />
//
// Requires: npm i qrcode
// Backend endpoints (Django):
//   POST   /api/capture-sessions/
//   GET    /api/capture-sessions/:id/
//   PUT    /api/capture-sessions/:id/photos/:angle/
//   GET    /capture/:id/          (phone capture page)

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

const ANGLES = ['front', 'left', 'right']
const INSTRUCTIONS = {
  front: 'Face the camera straight on',
  left: 'Turn your head to the LEFT',
  right: 'Turn your head to the RIGHT',
}
const POLL_INTERVAL = 1500
const SESSION_TTL_MS = (typeof __SESSION_TTL_MINUTES__ !== 'undefined' ? parseInt(__SESSION_TTL_MINUTES__, 10) : 60) * 60 * 1000

// Dev: point QR to ngrok. Prod: same origin.
// Override the host via VITE_PUBLIC_HOST env var so the QR code is
// reachable from a phone on the network (localhost won't work on mobile).
const PUBLIC_BASE =
  (typeof window !== 'undefined' && window.__NGROK_URL__) ||
  (typeof __PUBLIC_HOST__ !== 'undefined' && __PUBLIC_HOST__
    ? `http://${__PUBLIC_HOST__}:5173`
    : window.location.origin)

export default function LivenessStep({ formData, updateField }) {
  const photos = formData?.personal?.photos || { front: null, left: null, right: null }
  const complete = !!(photos.front && photos.left && photos.right)

  const [sessionId, setSessionId] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState(null)
  const [expired, setExpired] = useState(false)
  const pollRef = useRef(null)
  const expiryRef = useRef(null)

  // --- Create session + generate QR ---
  const startSession = useCallback(async () => {
    setError(null)
    setExpired(false)
    setQrDataUrl('')
    try {
      const res = await fetch('/api/origination/capture-sessions/', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create session')
      const { id, url } = await res.json()
      setSessionId(id)
      expiryRef.current = Date.now() + SESSION_TTL_MS

      const fullUrl = `${PUBLIC_BASE}${url}`
      const qr = await QRCode.toDataURL(fullUrl, { width: 200, margin: 1 })
      setQrDataUrl(qr)
    } catch (err) {
      setError(err.message || 'Failed to start capture session')
    }
  }, [])

  useEffect(() => {
    if (!complete) startSession()
    return () => {
      clearInterval(pollRef.current)
      clearTimeout(expiryRef.current)
    }
  }, [complete]) // eslint-disable-line

  // --- Poll for photos ---
  useEffect(() => {
    if (!sessionId || complete) return

    pollRef.current = setInterval(async () => {
      // Check local expiry
      if (expiryRef.current && Date.now() > expiryRef.current) {
        setExpired(true)
        clearInterval(pollRef.current)
        return
      }
      try {
        const res = await fetch(`/api/origination/capture-sessions/${sessionId}/`)
        if (res.status === 404) {
          setExpired(true)
          clearInterval(pollRef.current)
          return
        }
        const data = await res.json()
        if (data.photos) {
            
        updateField('personal', (prev = {}) => ({
        ...prev,
        photos: {
            front: data.photos.front || prev.photos?.front || null,
            left: data.photos.left || prev.photos?.left || null,
            right: data.photos.right || prev.photos?.right || null,
            capturedAt: data.photos.front ? new Date().toISOString() : prev.photos?.capturedAt,
        },
        }))
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL)

    return () => clearInterval(pollRef.current)
  }, [sessionId, complete, updateField])

  // --- Reset (retake) ---
  const handleReset = () => {
    updateField('personal', (prev) => ({
      ...prev,
      photos: { front: null, left: null, right: null, capturedAt: null },
    }))
    setSessionId(null)
    setQrDataUrl('')
    setExpired(false)
    setError(null)
    // Re-create session
    setTimeout(startSession, 100)
  }

  // --- Render ---
  return (
    <div className="mt-6 p-4 border border-input rounded-lg bg-background">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Passport Photo &amp; Liveness Verification
      </h3>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 rounded border border-destructive/20 bg-destructive/5 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Expired */}
      {expired && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Session expired.</p>
          <button onClick={handleReset} className="text-xs text-teal-600 underline">
            Start new session
          </button>
        </div>
      )}

      {/* Active: QR + progress */}
      {!complete && !expired && (
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* QR */}
          <div className="text-center shrink-0">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Scan with phone" className="w-40 h-40" />
            ) : (
              <div className="w-40 h-40 bg-muted animate-pulse rounded" />
            )}
            <p className="text-xs text-muted-foreground mt-2">Scan with your phone camera</p>
          </div>

          {/* Progress */}
          <div className="flex flex-col gap-2">
            {ANGLES.map((angle) => (
              <div key={angle} className="flex items-center gap-2">
                <div className="w-12 h-16 rounded overflow-hidden border border-input bg-muted flex items-center justify-center">
                  {photos[angle] ? (
                    <img src={photos[angle]} alt={angle} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground capitalize">{angle}</span>
                  )}
                </div>
                <div className="text-xs">
                  <span className={photos[angle] ? 'text-teal-600 font-medium' : 'text-muted-foreground'}>
                    {photos[angle] ? '✓ ' : '○ '}
                    {INSTRUCTIONS[angle]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete */}
      {complete && (
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {ANGLES.map((angle) => (
              <img
                key={angle}
                src={photos[angle]}
                alt={angle}
                className="w-12 h-16 object-cover rounded border-2 border-teal-500"
              />
            ))}
          </div>
          <span className="text-sm text-teal-600 font-medium">✓ Photos received</span>
          <button onClick={handleReset} className="text-xs text-muted-foreground underline hover:text-foreground">
            Retake
          </button>
        </div>
      )}
    </div>
  )
}   