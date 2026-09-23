// Document list / dashboard page
// TODO: implement

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocuments, createDocument, deleteDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => { loadDocuments(); }, []);

  const loadDocuments = async () =>
  {
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

  const handleCreate = async () =>
    {
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
  };

  if (loading) return <p style={{ padding: '16px' }}>Loading documents...</p>;
  if (error) return <p style={{ padding: '16px', color: 'red' }}>{error}</p>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>SyncDoc</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#555' }}>{user?.name}</span>
          <button onClick={handleCreate}>+ New Document</button>
          <button onClick={handleLogout}>Log Out</button>
        </div>
      </div>
      {documents.length === 0 ? (
        <p>No documents yet. Create one to get started.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documents.map((doc) => (
            <li key={doc._id} style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to={`/document/${doc._id}`}>{doc.title}</Link>
              <button onClick={() => handleDelete(doc._id, doc.title)} style={{ color: 'red' }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}