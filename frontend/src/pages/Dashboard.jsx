// Document list / dashboard page — renders inside AppLayout's <Outlet />
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocuments, createDocument, deleteDocument, updateDocument, joinRoomByCode } from '../services/api';
import Loader from '../components/Loader/Loader';
import { useAuth } from '../context/AuthContext';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // { id, title, isOwner }
  const [renameModal, setRenameModal] = useState(null); // { id, currentTitle, newTitle }
  const [resultModal, setResultModal] = useState(null); // { message: string }
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  // True when the logged-in user created (owns) this document
  const isOwnerOf = (doc) => {
    const ownerId = doc.owner && (doc.owner._id || doc.owner);
    return Boolean(ownerId && user && String(ownerId) === String(user.id));
  };

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

  const handleCreate = () => {
    setNewDocTitle('');
    setShowCreateModal(true);
  };

  const handleJoinRoom = () => {
    setJoinCode('');
    setJoinError('');
    setShowJoinModal(true);
  };

  const confirmJoinRoom = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoinLoading(true);
    setJoinError('');
    try {
      const res = await joinRoomByCode(code);
      setShowJoinModal(false);
      setResultModal({ type: 'success', message: `Request sent for "${res.data.title}". You'll get access once the owner approves it.` });
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Could not join with that code.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleConfirmCreate = async () => {
    const title = newDocTitle.trim();
    if (!title) return;
    try {
      const res = await createDocument({ title, content: [], ast: null });
      setShowCreateModal(false);
      navigate(`/document/${res.data._id}`);
    } catch {
      alert('Failed to create document.');
    }
  };

  const handleDelete = (id, title, isOwner) => {
    setOpenMenuId(null);
    setDeleteModal({ id, title, isOwner });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
    setDeleteModal(null);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch (error) {
      const reason = error.response && error.response.data && error.response.data.message;
      setResultModal({ type: 'error', message: reason || 'Failed to delete document.' });
    }
  };

  const handleRename = (id, currentTitle) => {
    setOpenMenuId(null);
    setRenameModal({ id, currentTitle, newTitle: currentTitle });
  };

  const confirmRename = async () => {
    const { id, currentTitle, newTitle } = renameModal;
    const trimmed = newTitle.trim();
    setRenameModal(null);
    if (!trimmed || trimmed === currentTitle) return;
    try {
      await updateDocument(id, { title: trimmed });
      setDocuments((prev) => prev.map((doc) => (doc._id === id ? { ...doc, title: trimmed } : doc)));
    } catch {
      setResultModal({ type: 'error', message: 'Failed to rename document.' });
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

  if (loading) return <Loader label="Loading documents..." />;
  if (error) return <p style={{ padding: '24px', color: 'salmon' }}>{error}</p>;

  return (
    <div className="page-inner" onClick={() => setOpenMenuId(null)}>
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
          filteredDocuments.map((doc, index) => (
            <div
              key={doc._id}
              className={`file-card accent-${index % 4}`}
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
                  <button className="danger" onClick={() => handleDelete(doc._id, doc.title, isOwnerOf(doc))}>
                    {isOwnerOf(doc) ? 'Delete' : 'Remove from my dashboard'}
                  </button>
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
                  <div className={`activity-item accent-${index % 4}`} onClick={() => navigate(`/document/${doc._id}`)}>
                    <div className="doc-icon">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

        <div className="dashboard-actions">
          <button className="join-room-btn" onClick={handleJoinRoom}>
            Join Room
          </button>
          <button className="new-doc-btn" onClick={handleCreate}>
            + New Document
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">New Document</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Document title....."
              value={newDocTitle}
              autoFocus
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCreate(); }}
            />
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="modal-btn-primary" onClick={handleConfirmCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Join a Room</h3>
            <p style={{ color: 'var(--text-light)', fontFamily: 'var(--font-sans)', fontSize: '14px', margin: '0 0 12px 0' }}>
              Enter the room code someone shared with you. The owner will need to approve your request.
            </p>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. SYNC-7F2K"
              value={joinCode}
              autoFocus
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmJoinRoom(); }}
            />
            {joinError && <p style={{ color: '#e07a5f', fontSize: '13px', margin: '8px 0 0 0' }}>{joinError}</p>}
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button className="modal-btn-primary" onClick={confirmJoinRoom} disabled={joinLoading}>
                {joinLoading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{deleteModal.isOwner ? 'Delete document?' : 'Remove from your dashboard?'}</h3>
            <p style={{ color: 'var(--text-light)', fontFamily: 'var(--font-sans)', fontSize: '14px', margin: '0 0 4px 0' }}>
              {deleteModal.isOwner
                ? `Delete "${deleteModal.title}"? This cannot be undone from the app.`
                : `Remove "${deleteModal.title}" from your dashboard? Only you lose access. The owner and other members keep the document.`}
            </p>
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="modal-btn-primary" onClick={confirmDelete}>OK</button>
            </div>
          </div>
        </div>
      )}

      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename document</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Document title....."
              value={renameModal.newTitle}
              autoFocus
              onChange={(e) => setRenameModal({ ...renameModal, newTitle: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); }}
            />
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setRenameModal(null)}>Cancel</button>
              <button className="modal-btn-primary" onClick={confirmRename}>OK</button>
            </div>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ color: resultModal.type === 'success' ? '#4caf82' : '#e07a5f' }}>
              {resultModal.type === 'success' ? 'Success' : 'Something went wrong'}
            </h3>
            <p style={{ color: 'var(--text-light)', fontFamily: 'var(--font-sans)', fontSize: '14px', margin: '0 0 4px 0' }}>
              {resultModal.message}
            </p>
            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={() => setResultModal(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}