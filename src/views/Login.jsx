import { useState } from 'react';
import { api } from '../lib/api';
import { Mail, Lock, ShieldCheck, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [otpStep, setOtpStep] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      if (!otpStep) {
        await api.login({ email, password });
        setOtpStep(true);
      } else {
        const response = await api.verifyOtp(email, otp);
        if (response.data?.warning) {
          setWarning(response.data.warning);
        }
        if (response.data?.access) {
          localStorage.setItem('accessToken', response.data.access);
          localStorage.setItem('refreshToken', response.data.refresh);
          if (response.data.user) {
            localStorage.setItem('userData', JSON.stringify(response.data.user));
          }
        }
        if (response.data?.user) {
          onLoginSuccess(response.data.user);
        } else {
          onLoginSuccess(null);
        }
      }
    } catch (err) {
      if (err.response) {
        if (err.response.status === 400) {
          setError(err.response.data || 'Invalid input. Please check your details.');
        } else if (err.response.status === 403) {
          setError(err.response.data.message || 'License error. Please contact administrator.');
        } else {
          setError(err.response.data || 'An error occurred. Please try again.');
        }
      } else {
        setError(err.message || 'Operation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageOverlay}>
      <div style={styles.cardContainer}>
        {/* Left Welcome Panel */}
        <div style={styles.leftPanel}>
          <div style={styles.circle1} />
          <div style={styles.circle2} />
          
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h1 style={styles.welcomeTitle}>WELCOME</h1>
            <p style={styles.welcomeSub}>PORTFOLIO ANALYTICS PLATFORM</p>
            <p style={styles.welcomeText}>
              Secure access to real-time metrics, risk management, and operational analytics.
            </p>
          </div>

          <div style={styles.copyright}>
            &copy; {new Date().getFullYear()} All rights reserved.
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={styles.rightPanel}>
          <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
            <h2 style={styles.formTitle}>
              {!otpStep ? 'Sign in' : 'Two-Factor Authentication'}
            </h2>
            <p style={styles.formSub}>
              {!otpStep
                ? 'Enter your credentials to access your account'
                : 'Please enter the 6-digit verification code sent to your email'}
            </p>

            {error && (
              <div style={styles.errorBox}>
                {typeof error === 'object' ? JSON.stringify(error) : error}
              </div>
            )}
            {warning && <div style={styles.warningBox}>{warning}</div>}

            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              {!otpStep ? (
                <>
                  {/* Email */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="email">Email Address</label>
                    <div style={styles.inputWrapper}>
                      <Mail size={18} style={styles.inputIcon} />
                      <input
                        id="email"
                        type="email"
                        required
                        placeholder="janedoe@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        style={styles.inputWithIcon}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="password">Password</label>
                    <div style={styles.inputWrapper}>
                      <Lock size={18} style={styles.inputIcon} />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        style={{ ...styles.inputWithIcon, paddingRight: 75 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        style={styles.togglePasswordBtn}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showPassword ? 'HIDE' : 'SHOW'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div style={styles.rowBetween}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ marginRight: 6, accentColor: '#b07d2b' }}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => (window.location.href = '/password-reset-request')}
                      style={styles.forgotBtn}
                    >
                      Forgot Password?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Read-only Email */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="email-readonly">Verification Email</label>
                    <div style={styles.inputWrapper}>
                      <Mail size={18} style={styles.inputIcon} />
                      <input
                        id="email-readonly"
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        style={{ ...styles.inputWithIcon, backgroundColor: '#eef1f0', color: '#666' }}
                      />
                    </div>
                  </div>

                  {/* OTP Code */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="otp">OTP Verification Code</label>
                    <div style={styles.inputWrapper}>
                      <ShieldCheck size={18} style={styles.inputIcon} />
                      <input
                        id="otp"
                        type="text"
                        required
                        maxLength="6"
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        disabled={loading}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        style={{ ...styles.inputWithIcon, letterSpacing: '0.25em', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setOtpStep(false)}
                      style={styles.backBtn}
                    >
                      <ArrowLeft size={14} style={{ marginRight: 4 }} /> Back to sign in
                    </button>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? otpStep
                    ? 'Verifying...'
                    : 'Logging in...'
                  : otpStep
                  ? 'Verify OTP'
                  : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Inline Styles guarantee rendering without Tailwind build step */
const styles = {
  pageOverlay: {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#f0f3f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  cardContainer: {
    width: '100%',
    maxWidth: '860px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    minHeight: '480px',
  },
  leftPanel: {
    width: '40%',
    background: 'linear-gradient(135deg, #176b63 0%, #b07d2b 100%)',
    padding: '40px 32px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    left: '-40px',
    top: '-40px',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    pointerEvents: 'none',
  },
  circle2: {
    position: 'absolute',
    right: '-50px',
    bottom: '-50px',
    width: '220px',
    height: '220px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    pointerEvents: 'none',
  },
  welcomeTitle: {
    fontSize: '28px',
    fontWeight: '800',
    letterSpacing: '1px',
    margin: '0 0 4px 0',
  },
  welcomeSub: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: '#d1fae5',
    margin: '0 0 20px 0',
  },
  welcomeText: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.85)',
    margin: 0,
  },
  copyright: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.6)',
    position: 'relative',
    zIndex: 2,
  },
  rightPanel: {
    width: '60%',
    padding: '40px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  },
  formTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 4px 0',
  },
  formSub: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
  },
  fieldGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#9ca3af',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    width: '100%',
    padding: '10px 12px 10px 38px',
    backgroundColor: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#1f2937',
    outline: 'none',
    boxSizing: 'border-box',
  },
  togglePasswordBtn: {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px 6px',
  },
  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    marginTop: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    color: '#4b5563',
    cursor: 'pointer',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#b07d2b',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: 0,
  },
  submitBtn: {
    width: '100%',
    marginTop: '20px',
    padding: '12px',
    backgroundColor: '#b07d2b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 6px -1px rgba(176, 125, 43, 0.3)',
    transition: 'background-color 0.2s',
  },
  errorBox: {
    padding: '10px 12px',
    marginTop: '12px',
    fontSize: '12px',
    borderRadius: '6px',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  warningBox: {
    padding: '10px 12px',
    marginTop: '12px',
    fontSize: '12px',
    borderRadius: '6px',
    backgroundColor: '#fffbe1',
    color: '#92400e',
    border: '1px solid #fef08a',
  },
};