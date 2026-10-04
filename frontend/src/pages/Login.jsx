import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { loginUser, googleLogin, forgotPassword } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Layout/AuthLayout';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

function GoogleLoginButton({ onLoginSuccess, onError }) {
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async ({ code }) => {
      onError('');
      setGoogleLoading(true);
      try {
        const res = await googleLogin(code);
        onLoginSuccess(res.data.token, res.data.user);
      } catch (err) {
        onError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => onError('Google sign-in was cancelled or failed. Please try again.'),
  });

  return (
    <button type="button" className="auth-google-btn" onClick={() => handleGoogle()} disabled={googleLoading}>
      <GoogleIcon />
      {googleLoading ? 'Signing in...' : 'Continue with Google'}
    </button>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // "Forgot password?" popup
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const openForgot = () => {
    setForgotEmail(email); // reuse the email they already typed, if any
    setForgotMessage('');
    setForgotError('');
    setShowForgot(true);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail);
      setForgotMessage(res.message);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Could not send the email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Login to SyncDoc">
      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <button type="button" className="auth-forgot-link" onClick={openForgot}>Forgot password?</button>
      {hasGoogleClientId && (
        <>
          <div className="auth-divider"><span>or</span></div>
          <GoogleLoginButton
            onLoginSuccess={(token, user) => {
              login(token, user);
              navigate('/dashboard');
            }}
            onError={setError}
          />
        </>
      )}
      <p className="auth-footer">
        Don't have an account? <Link to="/register">Sign up</Link>
      </p>
            {showForgot && (
        <div className="auth-modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="auth-modal-close" onClick={() => setShowForgot(false)} aria-label="Close">✕</button>
            <h2 className="auth-modal-title">Forgot your password?</h2>
            <p className="auth-modal-text">Enter your email and we'll send you a link to choose a new password.</p>
            <form onSubmit={handleForgot}>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input className="auth-input" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus />
              </div>
              {forgotError && <p className="auth-error">{forgotError}</p>}
              {forgotMessage && <p className="auth-info">{forgotMessage}</p>}
              <button className="auth-btn" type="submit" disabled={forgotLoading}>
                {forgotLoading ? 'Sending...' : 'Recover password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}