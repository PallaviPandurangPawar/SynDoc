// Shared app shell: top nav bar + sidebar. Stays mounted across page navigation —
// only the <Outlet /> content (Dashboard, Trash, etc.) swaps out.
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../pages/Dashboard.css';

export default function AppLayout() {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page" onClick={() => setAccountMenuOpen(false)}>
      <header className="top-nav">
        <div className="logo">
          <span className="logo-sync">Sync</span><span className="logo-doc">Doc</span>
        </div>
        <div className="top-nav-actions">
          <button className="nav-icon-btn" aria-label="User Profile" title="Profile" onClick={() => navigate('/profile')}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4.5" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>
          </button>
          <button className="nav-icon-btn" aria-label="Notifications" title="Notifications">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="profile-section">
            <div className="avatar-ring">
              {user?.avatarData ? (
              <img className="avatar-img" src={user.avatarData} alt={user?.name || 'Your avatar'} />
              ) : (
              <svg className="avatar-svg" viewBox="0 0 100 100" width="100%" height="100%">
                <defs>
                  <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a4b52" />
                    <stop offset="50%" stopColor="#2d2f36" />
                    <stop offset="100%" stopColor="#1c1d22" />
                  </linearGradient>
                  <linearGradient id="hair-grad" x1="0%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#3d3738" />
                    <stop offset="50%" stopColor="#222023" />
                    <stop offset="100%" stopColor="#141315" />
                  </linearGradient>
                  <linearGradient id="skin-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fde8db" />
                    <stop offset="100%" stopColor="#f5ceba" />
                  </linearGradient>
                  <linearGradient id="hoodie-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f7f7f9" />
                    <stop offset="100%" stopColor="#d6d9e0" />
                  </linearGradient>
                  <linearGradient id="orange-strap" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f87b50" />
                    <stop offset="100%" stopColor="#e3562a" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#bg-grad)" />
                <path d="M18 95 C21 72 32 66 50 66 C68 66 79 72 82 95 Z" fill="url(#hoodie-grad)" />
                <path d="M26 95 C28 80 34 72 38 69 L42 73 C38 77 34 84 32 95 Z" fill="url(#orange-strap)" />
                <path d="M74 95 C72 80 66 72 62 69 L58 73 C62 77 66 84 68 95 Z" fill="url(#orange-strap)" />
                <path d="M43 69 L50 78 L57 69 Z" fill="#252528" />
                <path d="M44 58 L44 68 C46 70 54 70 56 68 L56 58 Z" fill="url(#skin-grad)" />
                <path d="M36 41 C36 60 43 64 50 64 C57 64 64 60 64 41 C64 29 58 26 50 26 C42 26 36 29 36 41 Z" fill="url(#skin-grad)" />
                <ellipse cx="44" cy="42.5" rx="1.8" ry="2.2" fill="#201c1c" />
                <ellipse cx="56" cy="42.5" rx="1.8" ry="2.2" fill="#201c1c" />
                <circle cx="44.5" cy="41.7" r="0.6" fill="#ffffff" />
                <circle cx="56.5" cy="41.7" r="0.6" fill="#ffffff" />
                <path d="M41 38.5 Q44 37 47 38.5" stroke="#2a2323" strokeWidth="0.9" strokeLinecap="round" fill="none" />
                <path d="M53 38.5 Q56 37 59 38.5" stroke="#2a2323" strokeWidth="0.9" strokeLinecap="round" fill="none" />
                <path d="M50 45 L49.2 47 L50.8 47" stroke="#cfa692" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                <path d="M48 52 Q50 53 52 52" stroke="#bf8e78" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                <path d="M33 37 C29 27 38 17 50 17 C62 17 71 27 67 37 C72 43 71 54 68 59 C66 52 65 46 64 44 C64 27 58 23 50 23 C42 23 36 27 36 44 C35 46 34 52 32 59 C29 54 28 43 33 37 Z" fill="url(#hair-grad)" />
                <path d="M34 31 L39 39 L40 33 L45 43 L47 34 L52 45 L54 34 L59 42 L61 33 L65 39 L63 28 C58 21 42 21 34 31 Z" fill="url(#hair-grad)" />
                <path d="M59 37 L62.5 45 L60.5 36 Z" fill="#e85b3a" />
              </svg>
              )}
            </div>
            <h2 className="user-name">{user?.name || 'My Name'}</h2>
          </div>

          <div className="sidebar-divider"></div>

          <nav className="sidebar-menu">
            <button
              className={`menu-item${isActive('/') ? ' active' : ''}`}
              onClick={() => navigate('/')}
            >
              {isActive('/') && <span className="active-indicator-left"></span>}
              <span className="menu-text">Dashboard</span>
              {isActive('/') && <span className="active-indicator-right"></span>}
            </button>
            <button
              className={`menu-item${isActive('/profile') ? ' active' : ''}`}
              onClick={() => navigate('/profile')}
            >
              {isActive('/profile') && <span className="active-indicator-left"></span>}
              <span className="menu-text">My Profile</span>
              {isActive('/profile') && <span className="active-indicator-right"></span>}
            </button>
            <button
              className={`menu-item${isActive('/trash') ? ' active' : ''}`}
              onClick={() => navigate('/trash')}
            >
              {isActive('/trash') && <span className="active-indicator-left"></span>}
              <span className="menu-text">Trash</span>
              {isActive('/trash') && <span className="active-indicator-right"></span>}
            </button>
            <button className="menu-item"><span className="menu-text">Settings</span></button>
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-divider"></div>
            <div className="account-menu-wrapper" onClick={(e) => e.stopPropagation()}>
              <button className="user-account-row" onClick={() => setAccountMenuOpen((v) => !v)}>
                <div className="mini-avatar">
                  {user?.avatarData ? (
                    <img src={user.avatarData} alt={user?.name || 'Your avatar'} />
                  ) : (
                    <div className="mini-avatar-initial">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
                  )}
                </div>
                <span className="email-text">{user?.email || 'Email Id'}</span>
                <svg className="chevron-down" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {accountMenuOpen && (
                <div className="account-menu">
                  <button onClick={handleLogout}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="dashboard-board">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}