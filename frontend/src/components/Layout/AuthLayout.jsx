// Shared shell for Login, Register and OTP screens: top bar + centered card. No sidebar.
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import '../../pages/Auth.css';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function AuthLayout({ title, children }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="auth-page" data-theme={theme}>
      <header className="auth-header">
        <div className="auth-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Go to home page">
          <span className="auth-logo-sync">Sync</span>
          <span className="auth-logo-doc">Doc</span>
        </div>
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className={`auth-toggle-icon ${theme === 'light' ? 'active' : ''}`}><SunIcon /></span>
          <span className={`auth-toggle-icon ${theme === 'dark' ? 'active' : ''}`}><MoonIcon /></span>
        </button>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}