// Documents step — evidence slots and the product's required pack.
// Every slot is validated as a real, non-empty PDF/image and the pack is
// explained before submit; the backend's sync_pack_status remains the source
// of truth (DOC-08 / DOC-10).
//
// Contact verification is handled in PersonalInfoStep (step 1). By the time
// the user reaches this step, both email and phone should already be verified.

import { useEffect, useMemo, useState } from 'react'
import {
  DOC_LABELS,
  DOC_SLOT_FIELDS,
  SLOT_TO_DOC_TYPE,
  acceptsFile,
  isRealFile,
  missingPack,
  packChecklist,
} from '../../lib/documents'
import { requiredDocumentsFor } from '../lib/form'

// Server-side PersonDocument slot → canonical document type. Re-exported so
// callers migrating off DocumentVerification.jsx have one mapping to import
// (the same table the backend's FIELD_TO_DOC_TYPE uses).
export const FIELD_TO_DOC_TYPE = SLOT_TO_DOC_TYPE

const SUPPORTING_SLOTS = DOC_SLOT_FIELDS.filter(
  (slot) => !slot.key.startsWith('id_photo_'),
)

// Selected-file preview (migrated from the Document Verification page): images
// render as a thumbnail, PDFs open in a new tab. The object URL is revoked when
// the file changes or the step unmounts.
function SelectedFilePreview({ file }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return undefined }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url || !file) return null
  if (/\.pdf$/i.test(file.name || '')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-[var(--teal)] underline"
      >
        Preview PDF
      </a>
    )
  }
  return (
    <img
      src={url}
      alt={file.name}
      className="h-12 w-12 rounded border border-input object-cover"
    />
  )
}

function Slot({ slot, formData, required, error, onChange }) {
  const file = formData[slot.key]
  const hasFile = isRealFile(file)
  const docType = SLOT_TO_DOC_TYPE[slot.key]
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-input bg-background sm:flex-row sm:items-center">
      <span className="flex-shrink-0 text-muted-foreground">📄</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">
          {slot.label}
          <span className={`ml-2 text-xs font-normal ${required ? 'text-destructive' : 'text-muted-foreground'}`}>
            ({required ? 'Required' : 'Optional'})
          </span>
          {docType && (
            <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {docType}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{slot.accept} · max 12 MB</div>
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>
      <label className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-md hover:bg-accent cursor-pointer text-sm text-foreground transition-colors">
        {hasFile ? 'Change file' : 'Choose file'}
        <input
          type="file"
          accept={slot.accept}
          onChange={onChange}
          className="sr-only"
        />
      </label>
      {hasFile && (
        <div className="flex items-center gap-2 min-w-0">
          <SelectedFilePreview file={file} />
          <span className="text-xs text-teal-700 truncate max-w-[12rem]">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange({ target: { files: [] } })}
            className="text-xs text-destructive hover:text-destructive/80"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

export function DocumentsStep({ formData, updateField, product, required: requiredOverride }) {
  const [errors, setErrors] = useState({})

  const required = useMemo(() => {
    const pack = requiredOverride?.length
      ? requiredOverride
      : requiredDocumentsFor(product)
    return pack.map((d) => String(d).toUpperCase()).filter((d) => d !== 'COLLATERAL')
  }, [product, requiredOverride])

  const checklist = packChecklist(formData, required)
  const missing = missingPack(formData, required)
  const idRequired = required.includes('ID')

  const handleFileChange = (key) => (event) => {
    const file = event.target?.files?.[0] || null
    setErrors((prev) => ({ ...prev, [key]: null }))

    if (!file) {
      updateField(key, null)
      return
    }
    const check = acceptsFile(file)
    if (!check.ok) {
      setErrors((prev) => ({ ...prev, [key]: check.error }))
      if (event.target) event.target.value = ''
      return
    }

    if (key === 'id_photo_combined') {
      updateField('id_photo_front', null)
      updateField('id_photo_back', null)
    } else if (key === 'id_photo_front' || key === 'id_photo_back') {
      updateField('id_photo_combined', null)
    }
    updateField(key, file)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-accent/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Required document pack</p>
            <p className="text-xs text-muted-foreground">
              {product ? `${product.name} · ${product.product_class || 'UNSECURED'}` : 'Product pack'}
            </p>
          </div>
          <span className={`text-xs font-semibold ${missing.length ? 'text-amber-700' : 'text-teal-700'}`}>
            {missing.length ? `${missing.length} missing` : 'Complete'}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Files are submitted with the application as multipart form data; the backend stores
          them as PersonDocument evidence and runs extraction (ID, KRA PIN, M-Pesa,
          statements, CRB) on submit.
        </p>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {checklist.map((item) => (
            <li key={item.docType} className="flex items-center gap-2 text-xs">
              <span className={item.uploaded ? 'text-teal-600' : 'text-muted-foreground'}>
                {item.uploaded ? '✓' : '○'}
              </span>
              <span className={item.uploaded ? 'text-foreground' : 'text-muted-foreground'}>
                {DOC_LABELS[item.docType] || item.docType}
              </span>
            </li>
          ))}
        </ul>
        {String(product?.product_class || '').toUpperCase() === 'SECURED' && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Collateral evidence (valuation, logbook or title) is collected and verified by the
            secured-collateral workflow; it is not required to capture this application.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Identity {idRequired && <span className="text-destructive">*</span>}
        </p>
        <div className="space-y-2">
          <Slot
            slot={{ key: 'id_photo_combined', label: 'Combined ID (front + back PDF)', accept: '.pdf' }}
            formData={formData}
            required={idRequired}
            error={errors.id_photo_combined}
            onChange={handleFileChange('id_photo_combined')}
          />
          <Slot
            slot={{ key: 'id_photo_front', label: 'National ID — front', accept: '.jpg,.jpeg,.png,.pdf' }}
            formData={formData}
            required={idRequired}
            error={errors.id_photo_front}
            onChange={handleFileChange('id_photo_front')}
          />
          <Slot
            slot={{ key: 'id_photo_back', label: 'National ID — back', accept: '.jpg,.jpeg,.png,.pdf' }}
            formData={formData}
            required={idRequired}
            error={errors.id_photo_back}
            onChange={handleFileChange('id_photo_back')}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Upload both sides, or one combined PDF. A single side is not complete identity evidence.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2">Supporting documents</p>
        <div className="space-y-2">
          {SUPPORTING_SLOTS.map((slot) => (
            <Slot
              key={slot.key}
              slot={slot}
              formData={formData}
              required={required.includes(slot.docType)}
              error={errors[slot.key]}
              onChange={handleFileChange(slot.key)}
            />
          ))}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
          Missing required evidence: {missing.map((d) => DOC_LABELS[d] || d).join(', ')}.
        </div>
      )}
    </div>
  )
}