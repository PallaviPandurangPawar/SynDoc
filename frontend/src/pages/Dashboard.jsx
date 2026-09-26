// Document list / dashboard page
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocuments, createDocument, deleteDocument, updateDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

function formatTime(dateString) {
  const d = new Date(dateString);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours} : ${minutes} ${ampm}`;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => { loadDocuments(); }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await getDocuments();
      setDocuments(res.data || []);
    } catch {
      setError('Could not load documents. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreate = async () => {
    const title = window.prompt('Document title:');
    if (!title) return;
    try {
      const res = await createDocument({ title, content: [], ast: null });
      navigate(`/document/${res.data._id}`);
    } catch {
      alert('Failed to create document.');
    }
  };

  const handleDelete = async (id, title) => {
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone from the app.`);
    if (!confirmed) return;
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch {
      alert('Failed to delete document.');
    }
    setOpenMenuId(null);
  };

  const handleRename = async (id, currentTitle) => {
    setOpenMenuId(null);
    const newTitle = window.prompt('New document title:', currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;
    try {
      await updateDocument(id, { title: newTitle.trim() });
      setDocuments((prev) => prev.map((doc) => (doc._id === id ? { ...doc, title: newTitle.trim() } : doc)));
    } catch {
      alert('Failed to rename document.');
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    return documents.filter((doc) => doc.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [documents, search]);

  const recentActivity = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return documents
      .filter((doc) => new Date(doc.updatedAt).getTime() > dayAgo)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  }, [documents]);

  if (loading) return <div className="dashboard-page"><p style={{ padding: '24px' }}>Loading documents...</p></div>;
  if (error) return <div className="dashboard-page"><p style={{ padding: '24px', color: 'salmon' }}>{error}</p></div>;

  return (
    <div className="dashboard-page" onClick={() => { setOpenMenuId(null); setAccountMenuOpen(false); }}>
      <header className="top-nav">
        <div className="logo">
          <span className="logo-sync">Sync</span><span className="logo-doc">Doc</span>
        </div>
        <div className="top-nav-actions">
          <button className="nav-icon-btn" aria-label="User Profile" title="Profile">
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
            </div>
            <h2 className="user-name">{user?.name || 'My Name'}</h2>
          </div>

          <div className="sidebar-divider"></div>

          <nav className="sidebar-menu">
            <button className="menu-item active">
              <span className="active-indicator-left"></span>
              <span className="menu-text">Dashboard</span>
              <span className="active-indicator-right"></span>
            </button>
            <button className="menu-item"><span className="menu-text">My Profile</span></button>
            <button className="menu-item"><span className="menu-text">Trash</span></button>
            <button className="menu-item"><span className="menu-text">Settings</span></button>
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-divider"></div>
            <div className="account-menu-wrapper" onClick={(e) => e.stopPropagation()}>
              <button className="user-account-row" onClick={() => setAccountMenuOpen((v) => !v)}>
                <div className="mini-avatar">
                  <div className="mini-avatar-initial">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
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
            <section className="search-section">
              <div className="search-bar-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search your file....."
                  aria-label="Search your file"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="search-btn">Search</button>
              </div>
            </section>

            <section className="files-grid">
              {filteredDocuments.length === 0 ? (
                <p className="no-results">No documents found.</p>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={doc._id}
                    className="file-card"
                    onClick={() => navigate(`/document/${doc._id}`)}
                    style={{ zIndex: openMenuId === doc._id ? 30 : 'auto' }}
                  >
                    <span className="file-name">{doc.title}</span>
                    <button
                      className="options-btn"
                      aria-label="File options"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === doc._id ? null : doc._id); }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                    {openMenuId === doc._id && (
                      <div className="options-menu" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleRename(doc._id, doc.title)}>Rename</button>
                        <div className="menu-divider"></div>
                        <button className="danger" onClick={() => handleDelete(doc._id, doc.title)}>Delete</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            <div className="board-bottom">
              <div className="recent-activity-card">
                <h3 className="activity-title">Recent File Activity</h3>
                <div className="activity-list">
                  {recentActivity.length === 0 ? (
                    <p className="no-activity">No activity in the last 24 hours.</p>
                  ) : (
                    recentActivity.map((doc, index) => (
                      <div key={doc._id}>
                        {index > 0 && <div className="item-divider"></div>}
                        <div className="activity-item" onClick={() => navigate(`/document/${doc._id}`)}>
                          <div className="doc-icon">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#e88d67" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                          <div className="activity-details">
                            <span className="activity-filename">{doc.title}</span>
                            <span className="activity-author">Edited by {doc.lastModifiedBy || 'anonymous'}</span>
                          </div>
                          <div className="activity-time">{formatTime(doc.updatedAt)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button className="new-doc-btn" onClick={handleCreate}>
                + New Document
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}