// Personal Info step — identity, contact, liveness, and contact verification.
// Field names are the canonical snake_case contract shared with form.js.
// Email (SMTP) and phone (Africa's Talking) must both be verified before
// the wizard can advance. Verified fields are ghosted (readonly) so they
// cannot be edited after verification.

import { useCallback, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
} from 'lucide-react'
import LivenessStep from './LivenessStep'
import { ID_TYPES, ID_TYPES_REQUIRING_EXPIRY } from '../lib/form'
import { api } from '../../../../lib/api'
import { toast } from 'sonner'

const inputClass =
  'w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20'

// Primary action button (teal) — matches "Next" button styling
const primaryButtonClass = `
  flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
  bg-teal-600 text-white hover:bg-teal-700 focus:ring-2 focus:ring-teal-500/20
  disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]
`

// Secondary button (grey) — for "Verify Code" and "Resend"
const secondaryButtonClass = `
  flex items-center justify-center gap-1.5 px-3 py-2 border border-input rounded-md text-sm font-medium transition-colors whitespace-nowrap
  bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]
`

function Label({ children, required = false }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  )
}

// Six individual digit boxes for OTP entry.
function CodeInputs({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          value={value?.[i] || ''}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '')
            onChange(i, digit)
            if (digit && i < 5) {
              e.target.nextElementSibling?.focus()
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value?.[i]) {
              e.target.previousElementSibling?.focus()
            }
          }}
          disabled={disabled}
          className="w-6 h-8 text-center border border-input rounded-md text-sm font-mono focus:ring-2 focus:ring-teal-500/20"
        />
      ))}
    </div>
  )
}

// Inline field with input + verify button side by side, matching form design
function InlineVerificationField({
  label,
  icon: Icon,
  value,
  type,
  verified,
  codeSent,
  code,
  sending,
  verifying,
  error,
  onSendOtp,
  onVerifyOtp,
  onValueChange,
  fieldKey,
}) {
  return (
    <div className="space-y-2">
      <Label required>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input
            type={type}
            value={value}
            onChange={(e) => onValueChange(fieldKey, e.target.value)}
            disabled={verified}
            placeholder={type === 'email' ? 'e.g. amara@example.com' : 'e.g. 0712345678'}
            className={`${inputClass} ${verified ? 'bg-muted/50 cursor-not-allowed' : ''} ${Icon ? 'pl-10' : ''}`}
            autoComplete={type}
          />
        </div>
        <button
          onClick={onSendOtp}
          disabled={sending || verified || !value}
          className={`${primaryButtonClass} ${sending || verified ? 'opacity-50' : ''}`}
        >
          {sending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…
            </>
          ) : verified ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Verified
            </>
          ) : codeSent ? (
            <>
              <Icon className="h-3.5 w-3.5 mr-1.5" /> Resend
            </>
          ) : (
            <>
              <Icon className="h-3.5 w-3.5 mr-1.5" /> Verify
            </>
          )}
        </button>
      </div>

      {codeSent && !verified && (
        <div className="space-y-2 pl-0">
          <div className="flex items-center gap-2">
            <CodeInputs
              value={code}
              onChange={(i, d) => {
                const next = (code || '').split('')
                next[i] = d
                onValueChange(fieldKey + '_code', next.join(''))
              }}
              disabled={verifying}
            />
            <button
              onClick={onVerifyOtp}
              disabled={verifying || code.length < 6}
              className={secondaryButtonClass}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <Icon className="h-3.5 w-3.5 mr-1.5" /> Verify Code
                </>
              )}
            </button>
          </div>
          {error && <div className="text-xs text-destructive">{error}</div>}
          <p className="text-[10px] text-muted-foreground">
            Didn&rsquo;t get it? <button onClick={onSendOtp} className="text-teal-600 underline hover:text-teal-700">Resend code</button>
          </p>
        </div>
      )}

      {verified && (
        <div className="flex items-center gap-1.5 text-[11px] text-teal-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> {label} verified
        </div>
      )}
    </div>
  )
}

export function PersonalInfoStep({ formData, updateField }) {
  const expiryRequired = ID_TYPES_REQUIRING_EXPIRY.has(formData.id_type)

  // --- Contact verification state ---
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingPhone, setSendingPhone] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [phoneError, setPhoneError] = useState(null)

  const email = formData.email || ''
  const phone = formData.phone || ''
  const emailVerified = !!formData.email_verified
  const phoneVerified = !!formData.phone_verified
  const bothVerified = emailVerified && phoneVerified

  const handleSendEmailOtp = useCallback(async () => {
    if (!email || sendingEmail || emailVerified) return
    setSendingEmail(true)
    setEmailError(null)
    try {
      await api.sendEmailOtp(email)
      setEmailCodeSent(true)
      toast.success('Code sent to your email.')
    } catch (e) {
      setEmailError(e.message || 'Failed to send code. Try again.')
      toast.error('Failed to send email code.')
    } finally {
      setSendingEmail(false)
    }
  }, [email, sendingEmail, emailVerified])

  const handleVerifyEmailOtp = useCallback(async () => {
    if (!email || verifyingEmail || emailCode.length < 6) return
    setVerifyingEmail(true)
    setEmailError(null)
    try {
      await api.verifyContactOtp(email, emailCode)
      updateField('email_verified', true)
      setEmailCodeSent(false)
      setEmailCode('')
      toast.success('Email verified.')
    } catch (e) {
      setEmailError(e.message || 'Invalid or expired code.')
      toast.error('Verification failed.')
    } finally {
      setVerifyingEmail(false)
    }
  }, [email, verifyingEmail, emailCode, updateField])

  const handleSendSmsOtp = useCallback(async () => {
    if (!phone || sendingPhone || phoneVerified) return
    setSendingPhone(true)
    setPhoneError(null)
    try {
      await api.sendSmsOtp(phone)
      setPhoneCodeSent(true)
      toast.success('Code sent to your phone.')
    } catch (e) {
      setPhoneError(e.message || 'Failed to send code. Try again.')
      toast.error('Failed to send SMS code.')
    } finally {
      setSendingPhone(false)
    }
  }, [phone, sendingPhone, phoneVerified])

  const handleVerifySmsOtp = useCallback(async () => {
    if (!phone || verifyingPhone || phoneCode.length < 6) return
    setVerifyingPhone(true)
    setPhoneError(null)
    try {
      await api.verifyContactOtp(phone, phoneCode)
      updateField('phone_verified', true)
      setPhoneCodeSent(false)
      setPhoneCode('')
      toast.success('Phone verified.')
    } catch (e) {
      setPhoneError(e.message || 'Invalid or expired code.')
      toast.error('Verification failed.')
    } finally {
      setVerifyingPhone(false)
    }
  }, [phone, verifyingPhone, phoneCode, updateField])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label required>First Name</Label>
          <input
            type="text"
            value={formData.first_name || ''}
            onChange={(e) => updateField('first_name', e.target.value)}
            placeholder="e.g. Amara"
            className={inputClass}
            autoComplete="given-name"
          />
        </div>
        <div>
          <Label>Middle / Other Names</Label>
          <input
            type="text"
            value={formData.middle_name || ''}
            onChange={(e) => updateField('middle_name', e.target.value)}
            placeholder="e.g. Elizabeth"
            className={inputClass}
            autoComplete="additional-name"
          />
        </div>
        <div>
          <Label required>Last Name</Label>
          <input
            type="text"
            value={formData.last_name || ''}
            onChange={(e) => updateField('last_name', e.target.value)}
            placeholder="e.g. Okoye"
            className={inputClass}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label required>ID Type</Label>
          <select
            value={formData.id_type || 'NATIONAL_ID'}
            onChange={(e) => updateField('id_type', e.target.value)}
            className={inputClass}
          >
            {ID_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label required>ID Number</Label>
          <input
            type="text"
            value={formData.id_number || ''}
            onChange={(e) => updateField('id_number', e.target.value)}
            placeholder="e.g. 12345678"
            className={inputClass}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label required>Issuing Country</Label>
          <input
            type="text"
            value={formData.issuing_country || ''}
            onChange={(e) => updateField('issuing_country', e.target.value.toUpperCase())}
            placeholder="KE"
            maxLength={3}
            className={`${inputClass} font-mono uppercase`}
            autoComplete="country"
          />
        </div>
        <div>
          <Label required={expiryRequired}>ID Expiry</Label>
          <input
            type="date"
            value={formData.id_expiry || ''}
            onChange={(e) => updateField('id_expiry', e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {expiryRequired ? 'Required for passports and licences.' : 'Leave blank if the ID does not expire.'}
          </p>
        </div>
        <div>
          <Label required>Date of Birth</Label>
          <input
            type="date"
            value={formData.date_of_birth || ''}
            onChange={(e) => updateField('date_of_birth', e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className={inputClass}
            autoComplete="bday"
          />
        </div>
      </div>

      {/* --- Contact verification gate (must complete before advancing) --- */}
      <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Contact Details</p>
            <p className="text-[11px] text-muted-foreground">
              Verify your email and phone before proceeding. Both must be verified to continue.
            </p>
          </div>
          <span className={`text-xs font-semibold ${bothVerified ? 'text-teal-700' : 'text-amber-700'}`}>
            {bothVerified ? 'Verified' : `${[emailVerified, phoneVerified].filter(Boolean).length}/2 verified`}
          </span>
        </div>

        {/* Single row: Email group (field + btn) + Phone group (field + btn) — each 50% on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InlineVerificationField
            label="Email"
            icon={Mail}
            value={email}
            type="email"
            verified={emailVerified}
            codeSent={emailCodeSent}
            code={emailCode}
            sending={sendingEmail}
            verifying={verifyingEmail}
            error={emailError}
            onSendOtp={handleSendEmailOtp}
            onVerifyOtp={handleVerifyEmailOtp}
            onValueChange={updateField}
            fieldKey="email"
          />
          <InlineVerificationField
            label="Phone"
            icon={Phone}
            value={phone}
            type="tel"
            verified={phoneVerified}
            codeSent={phoneCodeSent}
            code={phoneCode}
            sending={sendingPhone}
            verifying={verifyingPhone}
            error={phoneError}
            onSendOtp={handleSendSmsOtp}
            onVerifyOtp={handleVerifySmsOtp}
            onValueChange={updateField}
            fieldKey="phone"
          />
        </div>

        {!bothVerified && (email || phone) && (
          <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
            Cannot proceed to the next step until both email and phone are verified.
          </div>
        )}
      </div>

      <LivenessStep formData={formData} updateField={updateField} />
    </div>
  )
}