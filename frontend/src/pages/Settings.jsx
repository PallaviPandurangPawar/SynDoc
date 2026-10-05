// Settings page — renders inside AppLayout's <Outlet />
import { useState, useEffect } from 'react';
import { forgotPassword, getProfile, updateTrashRetention } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Auth.css'; // reuses the exact "Forgot password" modal styling
import './Settings.css';

const RETENTION_OPTIONS = [1, 5, 7, 10, 15, 20, 25, 30];

export default function Settings() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [showReset, setShowReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  // null means "the saved value has not arrived from the server yet".
  // (Starting at 7 made the page show 7 for a moment after every refresh.)
  const [retentionDays, setRetentionDays] = useState(null);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionError, setRetentionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((res) => {
        if (!cancelled) setRetentionDays(res.data.trashRetentionDays || 7);
      })
      .catch(() => {
        if (!cancelled) setRetentionError('Could not load your current setting. Please refresh the page.');
      });
    return () => { cancelled = true; };
  }, []);

  const handleRetentionChange = async (e) => {
    const days = Number(e.target.value);
    const previous = retentionDays;
    setRetentionDays(days);
    setRetentionSaved(false);
    setRetentionError('');
    setRetentionSaving(true);
    try {
      await updateTrashRetention(days);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 2500);
    } catch {
      // The server did not accept it, so go back to what is really saved
      setRetentionDays(previous);
      setRetentionError('Could not save the setting. Your previous choice was kept.');
    } finally {
      setRetentionSaving(false);
    }
  };

  const openReset = () => {
    setResetMessage('');
    setResetError('');
    setShowReset(true);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);
    try {
      const res = await forgotPassword(user.email);
      setResetMessage(res.message);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Could not send the email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="page-inner settings-page-inner">
      <h2 className="settings-heading">Settings</h2>

      <div className="settings-card">
        <div className="settings-card-text">
          <h3>Reset Password</h3>
          <p>Send yourself a password reset link by email, without logging out.</p>
        </div>
        <button className="settings-reset-btn" onClick={openReset}>
          Reset Password
        </button>
      </div>

      <div className="settings-card">
        <div className="settings-card-text">
          <h3>Trash Retention</h3>
          <p>
            Files you delete from now on stay in Trash for this long before they're permanently removed.
            {retentionSaved && <span className="settings-saved-note"> Saved ✓</span>}
            {retentionError && <span className="settings-error-note"> {retentionError}</span>}
          </p>
        </div>
        <select
          className="settings-retention-select"
          value={retentionDays === null ? '' : retentionDays}
          onChange={handleRetentionChange}
          disabled={retentionDays === null || retentionSaving}
        >
          {retentionDays === null && <option value="" disabled>Loading...</option>}
          {RETENTION_OPTIONS.map((d) => (
            <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>
          ))}
        </select>
      </div>

      {showReset && (
        <div className="auth-modal-overlay auth-page" data-theme={theme} onClick={() => setShowReset(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="auth-modal-close" onClick={() => setShowReset(false)} aria-label="Close">✕</button>
            <h2 className="auth-modal-title">Forgot your password?</h2>
            <p className="auth-modal-text">Enter your email and we'll send you a link to choose a new password.</p>
            <form onSubmit={handleReset}>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input className="auth-input" type="email" value={user?.email || ''} readOnly />
              </div>
              {resetError && <p className="auth-error">{resetError}</p>}
              {resetMessage && <p className="auth-info">{resetMessage}</p>}
              <button className="auth-btn" type="submit" disabled={resetLoading}>
                {resetLoading ? 'Sending...' : 'Recover password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}