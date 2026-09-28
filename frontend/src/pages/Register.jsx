import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, verifyOtp, resendOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
      navigate('/');
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
      <div style={{ maxWidth: '360px', margin: '80px auto', padding: '24px' }}>
        <h1>Verify your email</h1>
        {info && <p style={{ color: 'green' }}>{info}</p>}
        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: '12px' }}>
            <label>Enter the 6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              style={{ width: '100%', padding: '8px', fontSize: '20px', letterSpacing: '6px', textAlign: 'center' }}
            />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading || otp.length !== 6} style={{ width: '100%', padding: '10px' }}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
        <p style={{ marginTop: '16px' }}>
          Didn't get the code?{' '}
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button type="button" onClick={handleResend} style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              Resend code
            </button>
          )}
        </p>
        <p>
          <button type="button" onClick={goBack} style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
            Change email or password
          </button>
        </p>
      </div>
    );
  }

  // ── Sign-up form screen ──
  return (
    <div style={{ maxWidth: '360px', margin: '80px auto', padding: '24px' }}>
      <h1>Create your SyncDoc account</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label>Password (min 6 characters)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '8px' }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
          {loading ? 'Sending code...' : 'Sign Up'}
        </button>
      </form>
      <p style={{ marginTop: '16px' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}