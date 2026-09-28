import { useState } from 'react';
import { api } from '../lib/api';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';

export default function PasswordResetRequest({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await api.passwordReset({ email });
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageOverlay}>
      <div style={styles.cardContainer}>
        {/* Left Welcome / Branding Panel */}
        <div style={styles.leftPanel}>
          <div style={styles.circle1} />
          <div style={styles.circle2} />
          
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h1 style={styles.welcomeTitle}>RESET ACCESS</h1>
            <p style={styles.welcomeSub}>PORTFOLIO ANALYTICS PLATFORM</p>
            <p style={styles.welcomeText}>
              Enter your registered account email address to receive password recovery instructions.
            </p>
          </div>

          <div style={styles.copyright}>
            &copy; {new Date().getFullYear()} All rights reserved.
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={styles.rightPanel}>
          <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
            <h2 style={styles.formTitle}>Reset Password</h2>
            <p style={styles.formSub}>
              We will email you a secure link to reset your account password
            </p>

            {/* Error Message */}
            {error && (
              <div style={styles.errorBox}>
                {typeof error === 'object' ? JSON.stringify(error) : error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div style={styles.successBox}>
                Reset email sent! Please check your inbox for instructions.
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              {/* Email Input Field */}
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
                <KeyRound size={16} style={{ marginRight: 6 }} />
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              {/* Back to Login Link */}
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => (window.location.href = '/')}
                  style={styles.backBtn}
                >
                  <ArrowLeft size={14} style={{ marginRight: 4 }} /> Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Inline Styles matching Login layout and palette */
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
  backBtn: {
    background: 'none',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
  },
  submitBtn: {
    width: '100%',
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#b07d2b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 6px -1px rgba(176, 125, 43, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  successBox: {
    padding: '10px 12px',
    marginTop: '12px',
    fontSize: '12px',
    borderRadius: '6px',
    backgroundColor: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
};