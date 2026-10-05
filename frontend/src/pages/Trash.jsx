// Trash page — soft-deleted documents, renders inside AppLayout's <Outlet />
import { useEffect, useMemo, useState } from 'react';
import { getTrash, getProfile, restoreDocument, permanentlyDeleteDocument } from '../services/api';
import { timeLeftLabel } from '../lib/trashTime';
import Loader from '../components/Loader/Loader';
import './Trash.css';

export default function Trash() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // { id, title }
  const [resultModal, setResultModal] = useState(null); // { message: string }
  const [retentionSetting, setRetentionSetting] = useState(null); // the user's current choice from Settings

  useEffect(() => { loadTrash(); }, []);

  const loadTrash = async () => {
    try {
      setLoading(true);
      const [res, profile] = await Promise.all([
        getTrash(),
        getProfile().catch(() => null)
      ]);
      setDocuments(res.data || []);
      setRetentionSetting(profile && profile.data ? profile.data.trashRetentionDays : null);
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

  const handleDeleteForever = (id, title) => {
    setOpenMenuId(null);
    setDeleteModal({ id, title });
  };

  const confirmDeleteForever = async () => {
    const { id } = deleteModal;
    setDeleteModal(null);
    try {
      await permanentlyDeleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch {
      setResultModal({ message: 'Failed to delete document.' });
    }
  };


  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    return documents.filter((doc) => doc.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [documents, search]);

  if (loading) return <Loader label="Loading trash..." />;
  if (error) return <p style={{ padding: '24px', color: 'salmon' }}>{error}</p>;

  return (
    <div className="page-inner" onClick={() => setOpenMenuId(null)}>
      <section className="trash-header-row">
        <div>
          <h2 className="trash-title">Trash</h2>
          <p className="trash-subtitle">
            {retentionSetting
              ? `Files you delete now are kept for ${retentionSetting} day${retentionSetting === 1 ? '' : 's'}, then removed automatically. Files already here keep the time shown on their card.`
              : 'Deleted files are removed automatically when their time runs out.'}
          </p>
        </div>
        <div className="trash-search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search your file....."
            aria-label="Search trash"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="search-btn">Search</button>
        </div>
      </section>

      <section className="files-grid">
        {filteredDocuments.length === 0 ? (
          <p className="no-results">{documents.length === 0 ? 'Trash is empty.' : 'No matching documents found.'}</p>
        ) : (
          filteredDocuments.map((doc) => {
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
                  {timeLeftLabel(doc.deletedAt, doc.trashRetentionDays)}
                </span>
              </div>
            );
          })
        )}
      </section>

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete forever?</h3>
            <p style={{ color: 'var(--text-light)', fontFamily: 'var(--font-sans)', fontSize: '14px', margin: '0 0 4px 0' }}>
              Permanently delete "{deleteModal.title}"? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="modal-btn-primary" onClick={confirmDeleteForever}>OK</button>
            </div>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ color: '#e07a5f' }}>Something went wrong</h3>
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