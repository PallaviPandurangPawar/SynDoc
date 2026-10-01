import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, verifyOtp, resendOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/Layout/AuthLayout';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('form'); // 'form' -> 'otp'
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds until Resend is allowed
  const { login } = useAuth();
  const navigate = useNavigate();

  // Counts the resend cooldown down by one every second
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Step 1: send name/email/password, backend emails the OTP
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await registerUser({ name, email, password });
      setStep('otp');
      setCooldown(60);
      setInfo(`We sent a 6-digit code to ${email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: send the OTP, backend verifies it and returns the login token
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await verifyOtp({ email, otp });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await resendOtp({ email });
      setCooldown(60);
      setOtp('');
      setInfo('A new code has been sent to your email');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code.');
    }
  };

  const goBack = () => {
    setStep('form');
    setOtp('');
    setError('');
    setInfo('');
  };

  // ── OTP screen ──
  if (step === 'otp') {
    return (
      <AuthLayout title="Verify your email">
        {info && <p className="auth-info">{info}</p>}
        <form onSubmit={handleVerify}>
          <div className="auth-field">
            <label className="auth-label">Enter the 6-digit code</label>
            <input
              className="auth-input auth-otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn" type="submit" disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
        <p className="auth-footer">
          Didn't get the code?{' '}
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button type="button" className="auth-link-btn" onClick={handleResend}>
              Resend code
            </button>
          )}
        </p>
        <p className="auth-footer">
          <button type="button" className="auth-link-btn" onClick={goBack}>
            Change email or password
          </button>
        </p>
      </AuthLayout>
    );
  }

  // ── Sign-up form screen ──
  return (
    <AuthLayout title="Create your SyncDoc account">
      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Name</label>
          <input className="auth-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="auth-field">
          <label className="auth-label">Password (min 6 characters)</label>
          <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Sending code...' : 'Sign Up'}
        </button>
      </form>
      <p className="auth-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}