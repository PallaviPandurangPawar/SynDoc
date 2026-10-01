import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../services/api';
import AuthLayout from '../components/Layout/AuthLayout';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || ''; // the secret that came in the email link
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setSuccess(res.message);
      // Show the message for a moment, then go to the login page
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Opened without a token (for example someone typed the address by hand)
  if (!token) {
    return (
      <AuthLayout title="Reset password">
        <p className="auth-error">This reset link is not valid. Please request a new one from the login page.</p>
        <p className="auth-footer">
          <Link to="/login">Back to login</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      {success ? (
        <>
          <p className="auth-info">{success}</p>
          <p className="auth-footer">
            Taking you to the login page... <Link to="/login">Go now</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">New password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Confirm new password</label>
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Changing...' : 'Change password'}
          </button>
          <p className="auth-footer">
            <Link to="/login">Back to login</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}