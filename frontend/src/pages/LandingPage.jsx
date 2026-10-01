// Public landing page — the first thing visitors see at "/"
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './LandingPage.css';

const FEATURES = [
  { icon: '⚡', title: 'Real-Time Collaboration', text: 'See changes instantly and work together from anywhere.' },
  { icon: '🛡', title: 'Safe & Smart Editing', text: 'AST conflict resolution protects your work and merges changes automatically.' },
  { icon: '👥', title: 'Flexible Access', text: 'Work with your team — on any device, anytime.' },
  { icon: '☁', title: 'Secure & Reliable', text: 'Your data is protected with MongoDB and robust architecture.' },
  { icon: '🚀', title: 'Boost Productivity', text: 'Fewer conflicts, less rework, more progress.' },
  { icon: '👨‍👩‍👧', title: 'Built for Teams', text: 'Perfect for students, professionals and collaborative projects.' },
  { icon: '♡', title: 'Simple & Modern UI', text: 'Clean design, smooth experience, built for you.' },
];

const DEMO_USERS = [
  { letter: 'A', name: 'User A', status: 'Editing...' },
  { letter: 'B', name: 'User B', status: 'Editing...' },
  { letter: 'C', name: 'User C', status: 'Viewing...' },
];

const CODE_LINES = ['long', 'medium', 'blue', 'long', 'green', 'medium', 'purple', 'short', 'long'];

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

const scrollToFeatures = (e) => {
  e.preventDefault();
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
};

const scrollToTop = (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Logged-in visitors skip the login page and go straight to their dashboard
  const startLink = user ? '/dashboard' : '/login';
  const startLabel = user ? 'Open Dashboard →' : 'Get Started →';

  return (
    <div className="lp-page" data-theme={theme}>
      {/* ===== NAVBAR ===== */}
      <div className="lp-navbar-wrapper">
        <nav className="lp-navbar">
          <a href="#" className="lp-logo" onClick={scrollToTop}>
            <div className="lp-logo-icon">↻</div>
            <span>SyncDoc</span>
          </a>

          <div className="lp-nav-links">
            <a href="#" className="active" onClick={scrollToTop}>Home</a>
            <a href="#features" onClick={scrollToFeatures}>Features</a>
          </div>

          <div className="lp-nav-right">
            <button
              type="button"
              className="lp-theme-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className={`lp-toggle-icon ${theme === 'light' ? 'active' : ''}`}><SunIcon /></span>
              <span className={`lp-toggle-icon ${theme === 'dark' ? 'active' : ''}`}><MoonIcon /></span>
            </button>
            <Link to={startLink} className="lp-get-started">{startLabel}</Link>
          </div>
        </nav>
      </div>

      {/* ===== HERO ===== */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-badge">Collaborative Document Engine</div>

          <h1 className="lp-hero-title">
            Sync<span className="lp-gradient">Doc</span>
          </h1>

          <h2 className="lp-hero-subtitle">
            Create&nbsp; • &nbsp;Edit&nbsp; • &nbsp;Build
            <br />
            Together, in <span className="lp-gradient-alt">Real-Time</span>
          </h2>

          <p className="lp-hero-description">
            SyncDoc is a modern, real-time collaborative document engine powered by AST
            conflict resolution. Work together, edit safely, and keep your changes in
            sync — always.
          </p>

          <div className="lp-hero-buttons">
            <Link to={startLink} className="lp-primary-btn">Start Collaborating →</Link>
            <a href="#features" className="lp-secondary-btn" onClick={scrollToFeatures}>↓ &nbsp;Explore Features</a>
          </div>
        </div>

        {/* ===== PRODUCT VISUAL ===== */}
        <div className="lp-hero-visual">
          <div className="lp-sync-cloud">↻</div>
          <div className="lp-floating-user lp-user-one">●</div>
          <div className="lp-floating-user lp-user-two">●</div>
          <div className="lp-floating-user lp-user-three">●</div>

          <div className="lp-editor-window">
            <div className="lp-window-top">
              <span className="lp-window-dot"></span>
              <span className="lp-window-dot"></span>
              <span className="lp-window-dot"></span>
              <span style={{ marginLeft: '10px' }}>Project_Document.md</span>
            </div>

            <div className="lp-document-area">
              <div className="lp-users-panel">
                {DEMO_USERS.map((u) => (
                  <div className="lp-user" key={u.letter}>
                    <div className="lp-user-avatar">{u.letter}</div>
                    <span>
                      {u.name}
                      <br />
                      <small>{u.status}</small>
                    </span>
                  </div>
                ))}
              </div>

              <div className="lp-code-area">
                {CODE_LINES.map((type, i) => (
                  <div key={i} className={`lp-code-line ${type}`}></div>
                ))}
              </div>
            </div>
          </div>

          <div className="lp-ast-card">
            <div className="lp-ast-title">◇ &nbsp;AST Conflict Resolution</div>
            {['Detect Conflicts', 'Merge Changes', 'Keep Everyone in Sync'].map((label) => (
              <div className="lp-ast-item" key={label}>
                <span className="lp-check">✓</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY SYNCDOC ===== */}
      <section className="lp-why" id="features">
        <h2 className="lp-section-heading">
          <span className="lp-heading-line"></span>
          Why <span className="lp-gradient">SyncDoc?</span>
          <span className="lp-heading-line"></span>
        </h2>

        <p className="lp-section-description">
          No more version chaos. No more lost changes. SyncDoc keeps your ideas, work and
          team in perfect sync — so you can focus on what really matters.
        </p>

        <div className="lp-feature-grid">
          {FEATURES.map((f) => (
            <div className="lp-feature" key={f.title}>
              <div className="lp-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>

        <div className="lp-story">
          <h2>
            What is <span className="lp-gradient">SyncDoc?</span>
          </h2>
          <p>
            SyncDoc makes document collaboration simple and connected. Multiple users can
            edit the same document at the same time without worrying about overwriting each
            other's work. Changes are synchronized instantly across every connected user.
            Its AST-based conflict resolution intelligently handles structural changes.
            This means fewer conflicts, less rework and a smoother way for teams to create
            together.
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        SyncDoc © 2026 — Collaborate. Create. Stay in Sync.
      </footer>
    </div>
  );
}