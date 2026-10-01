// Document editor page — full-screen, outside AppLayout
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocumentById, updateDocument, getRoomCode, regenerateRoomCode, toggleRoomCode } from '../services/api';
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
  const [ownerId, setOwnerId] = useState(null);
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomEnabled, setRoomEnabled] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleRef = useRef(null);

  const isOwner = user?.id && ownerId && user.id === ownerId;


  useEffect(() => { loadDocument(); }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const res = await getDocumentById(id);
      setTitle(res.data?.title || 'Untitled Document');
      setOwnerId(res.data?.owner?._id || res.data?.owner || null);
    } catch {
      setError('Could not load this document. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  // Loads the room code + (if owner) the pending join requests
  const loadRoomInfo = async () => {
    try {
      const res = await getRoomCode(id);
      setRoomCode(res.data.roomCode);
      setRoomEnabled(res.data.roomCodeEnabled);
    } catch {
      // non-critical
    }
  };

  const handleOpenRoomPanel = () => {
    setShowRoomPanel(true);
    loadRoomInfo();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleRoom = async () => {
    setRoomLoading(true);
    try {
      const res = await toggleRoomCode(id, !roomEnabled);
      setRoomEnabled(res.data.roomCodeEnabled);
      setRoomCode(res.data.roomCode);
    } catch {
      alert('Could not update the room setting.');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    setRoomLoading(true);
    try {
      const res = await regenerateRoomCode(id);
      setRoomCode(res.data.roomCode);
      setRoomEnabled(res.data.roomCodeEnabled);
    } catch {
      alert('Could not regenerate the code.');
    } finally {
      setRoomLoading(false);
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
          <button className="doc-back-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>

          <span className="doc-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Go to home page">
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

          <button className="doc-export-btn outline" onClick={handleOpenRoomPanel}>
            Room
          </button>

          <div className="doc-export-group">
            <button className="doc-export-btn outline" onClick={() => handleExport('html')} disabled={exporting}>HTML</button>
            <button className="doc-export-btn solid" onClick={() => handleExport('pdf')} disabled={exporting}>PDF</button>
          </div>
        </div>
      </header>

      {showRoomPanel && (
        <div className="modal-overlay" onClick={() => setShowRoomPanel(false)}>
          <div className="room-panel-card" onClick={(e) => e.stopPropagation()}>
            <div className="room-panel-header">
              <h3>Room Code</h3>
              <button className="room-panel-close" onClick={() => setShowRoomPanel(false)}>✕</button>
            </div>

            <p className="room-panel-subtitle">
              Anyone with this code can request to join this document. You'll get an email
              with one-click Approve/Deny links — no need to check back here.
            </p>

            <div className="room-code-row">
              <span className="room-code-value">
                {roomCode ? roomCode : (isOwner ? '...' : 'XXXX-XXXX')}
              </span>
              <button className="room-code-copy" onClick={handleCopyCode} disabled={!roomCode}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {!isOwner && (
              <p className="room-panel-subtitle" style={{ margin: '8px 0 0 0' }}>
                Only the document owner can view and share this code.
              </p>
            )}

            {isOwner && (
              <div className="room-panel-controls">
                <label className="room-toggle">
                  <input type="checkbox" checked={roomEnabled} onChange={handleToggleRoom} disabled={roomLoading} />
                  <span>Joining {roomEnabled ? 'enabled' : 'disabled'}</span>
                </label>
                <button className="room-regen-btn" onClick={handleRegenerateCode} disabled={roomLoading}>
                  Regenerate code
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="doc-main">
        <EditorCanvas documentId={id} socket={socket} activeUsers={activeUsers} updateCursor={updateCursor} />
      </main>
    </div>
  );
}