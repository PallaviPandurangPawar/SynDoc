// Document list / dashboard page
// TODO: implement

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocuments, createDocument } from '../services/api';

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  if (loading) return <p style={{ padding: '16px' }}>Loading documents...</p>;
  if (error) return <p style={{ padding: '16px', color: 'red' }}>{error}</p>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>SyncDoc</h1>
        <button onClick={handleCreate}>+ New Document</button>
      </div>
      {documents.length === 0 ? (
        <p>No documents yet. Create one to get started.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documents.map((doc) => (
            <li key={doc._id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <Link to={`/document/${doc._id}`}>{doc.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}