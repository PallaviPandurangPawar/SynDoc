// Trash page — soft-deleted documents, renders inside AppLayout's <Outlet />
import { useEffect, useState } from 'react';
import { getTrash, restoreDocument, permanentlyDeleteDocument } from '../services/api';
import Loader from '../components/Loader/Loader';
import './Trash.css';

const TRASH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function daysRemaining(deletedAt) {
  const expiresAt = new Date(deletedAt).getTime() + TRASH_WINDOW_MS;
  const msLeft = expiresAt - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

export default function Trash() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => { loadTrash(); }, []);

  const loadTrash = async () => {
    try {
      setLoading(true);
      const res = await getTrash();
      setDocuments(res.data || []);
    } catch {
      setError('Could not load trash. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    setOpenMenuId(null);
    try {
      await restoreDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch {
      alert('Failed to restore document.');
    }
  };

  const handleDeleteForever = async (id, title) => {
    setOpenMenuId(null);
    const confirmed = window.confirm(`Permanently delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await permanentlyDeleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch {
      alert('Failed to delete document.');
    }
  };

  if (loading) return <Loader label="Loading trash..." />;
  if (error) return <p style={{ padding: '24px', color: 'salmon' }}>{error}</p>;

  return (
    <div className="page-inner" onClick={() => setOpenMenuId(null)}>
      <section className="trash-header-row">
        <h2 className="trash-title">Trash</h2>
        <p className="trash-subtitle">
          Items are kept for 7 days, then deleted automatically.
        </p>
      </section>

      <section className="files-grid">
        {documents.length === 0 ? (
          <p className="no-results">Trash is empty.</p>
        ) : (
          documents.map((doc) => {
            const days = daysRemaining(doc.deletedAt);
            return (
              <div
                key={doc._id}
                className="file-card trash-card"
                style={{ zIndex: openMenuId === doc._id ? 30 : 'auto' }}
              >
                <div className="trash-card-top">
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
                      <button onClick={() => handleRestore(doc._id)}>Restore</button>
                      <div className="menu-divider"></div>
                      <button className="danger" onClick={() => handleDeleteForever(doc._id, doc.title)}>Delete Forever</button>
                    </div>
                  )}
                </div>
                <span className="trash-expiry">
                  {days === 0 ? 'Deletes today' : `${days} day${days === 1 ? '' : 's'} left`}
                </span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}