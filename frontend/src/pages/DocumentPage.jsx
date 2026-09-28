// Document editor page — full-screen, outside AppLayout
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocumentById, updateDocument } from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { usePresence } from '../hooks/usePresence';
import EditorCanvas from '../components/Editor/EditorCanvas';
import Loader from '../components/Loader/Loader';
import './DocumentPage.css';

export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { socket, connected } = useSocket();
  const { activeUsers, updateCursor } = usePresence(socket, id, user?.name || 'Anonymous');

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { loadDocument(); }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const res = await getDocumentById(id);
      setTitle(res.data?.title || 'Untitled Document');
    } catch {
      setError('Could not load this document. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle('Untitled Document');
      return;
    }
    try {
      await updateDocument(id, { title: trimmed });
    } catch {
      // Non-critical — title just won't persist this time, no need to interrupt editing.
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const response = await api.get(`/export/documents/${id}/${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title || 'document'}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please check that the backend server is running.');
    } finally {
      setExporting(false);
    }
  };

  const otherUsers = activeUsers.filter((u) => u.socketId !== socket?.id);

  if (loading) return <div className="document-page" data-theme={theme}><Loader label="Loading document..." /></div>;
  if (error) return <div className="document-page" data-theme={theme}><p style={{ padding: '24px', color: 'salmon' }}>{error}</p></div>;

  return (
    <div className="document-page" data-theme={theme}>
      <header className="doc-header">
        <div className="doc-header-left">
          <button className="doc-back-btn" onClick={() => navigate('/')} title="Back to Dashboard" aria-label="Back to Dashboard">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>

          <span className="doc-logo">
            <span className="doc-logo-sync">Sync</span><span className="doc-logo-doc">Doc</span>
          </span>

          <div className="doc-divider"></div>

          <input
            ref={titleRef}
            type="text"
            className="doc-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') titleRef.current?.blur(); }}
            placeholder="File name..."
            title="Click to rename document"
          />
        </div>

        <div className="doc-header-right">
          <button className="doc-back-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="12" y1="2" x2="12" y2="4"></line>
                <line x1="12" y1="20" x2="12" y2="22"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="2" y1="12" x2="4" y2="12"></line>
                <line x1="20" y1="12" x2="22" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <div className="doc-status-group">
            <span className={`doc-connection-pill${connected ? '' : ' offline'}`}>
              <span className="doc-connection-dot"></span>
              {connected ? 'Connected' : 'Connecting...'}
            </span>
            <span className="doc-editing-badge">{user?.name || 'You'}</span>
          </div>

          <div className="doc-collab-pill">
            <span className="doc-collab-label">Collaborators:</span>
            <div className="doc-collab-avatars">
              <span className="doc-avatar-dot self" title={`${user?.name || 'You'} (You)`}>
                {(user?.name || '?').charAt(0).toUpperCase()}
              </span>
              {otherUsers.slice(0, 3).map((u) => (
                <span key={u.socketId} className="doc-avatar-dot" style={{ background: u.color }} title={u.name}>
                  {(u.name || '?').charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
            <span className="doc-collab-count">{otherUsers.length + 1} online</span>
          </div>

          <div className="doc-export-group">
            <button className="doc-export-btn outline" onClick={() => handleExport('html')} disabled={exporting}>HTML</button>
            <button className="doc-export-btn solid" onClick={() => handleExport('pdf')} disabled={exporting}>PDF</button>
          </div>
        </div>
      </header>

      <main className="doc-main">
        <EditorCanvas documentId={id} socket={socket} activeUsers={activeUsers} updateCursor={updateCursor} />
      </main>
    </div>
  );
}