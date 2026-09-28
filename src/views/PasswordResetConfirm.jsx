import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function PasswordResetConfirm({ onSuccess, token }) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Token might come from URL params or state
    // For simplicity, we'll expect it to be passed as prop
    // In a real app, you might parse it from window.location.search
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (password !== password2) {
        throw new Error('Passwords do not match');
      }
      await api.passwordResetConfirm({ token, password });
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 360, margin: '40px auto' }}>
      <h2 style={{ textAlign: 'center' }}>Reset Password</h2>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">Password reset successful!</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="password2">Confirm New Password</label>
          <input
            id="password2"
            type="password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={loading}
          />
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            type="submit"
            className="btn brass"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => window.location.href = '/'}
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}