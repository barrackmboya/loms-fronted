// Documents step — step 3 of the loan application form.
// Field names match useLoanApplication's mapFormToPayload.

import { useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { toast } from '../../../../components/ui/sonner'

export function DocumentsStep({ formData, updateField }) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const videoRef = useRef(null)

  const handleFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null
    // Mutual exclusivity: combined PDF clears separate front/back, and vice versa
    if (key === 'id_photo_combined' && file) {
      updateField('id_photo_front', null)
      updateField('id_photo_back', null)
    } else if ((key === 'id_photo_front' || key === 'id_photo_back') && file) {
      updateField('id_photo_combined', null)
    }
    updateField(key, file)
  }

  const startScan = async () => {
    setScanError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      const video = videoRef.current
      if (!video) throw new Error('Video element not found')
      video.srcObject = stream
      await video.play()

      const reader = new BrowserQRCodeReader()
      const result = await reader.decodeFromVideoElement(video, 10000)

      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
      setScanning(false)
      updateField('nationalId', result.text)
      toast.success(`QR code scanned: ${result.text}`)
    } catch (err) {
      setScanError(err.message || 'Failed to scan QR code')
      setScanning(false)
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }

  const stopScan = () => {
    setScanning(false)
    setScanError(null)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const DOCS = [
    { key: 'id_photo_front', label: 'National ID Photo Front', accept: '.jpg,.jpeg,.png' },
    { key: 'id_photo_back', label: 'National ID Photo Back', accept: '.jpg,.jpeg,.png' },
    { key: 'id_photo_combined', label: 'Combined ID (Front + Back PDF)', accept: '.pdf' },
    { key: 'kra_certificate', label: 'KRA PIN Certificate', accept: '.pdf,.jpg,.jpeg,.png' },
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
              <label
                className="ml-4 flex items-center gap-2 px-3 py-1.5 border border-input rounded-md hover:bg-accent cursor-pointer text-sm text-foreground transition-colors"
              >
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
