// Trigger PDF/HTML export
import { useState } from 'react';
import axios from 'axios';

export default function ExportButton({ documentId }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/export/documents/${documentId}/${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Export failed. Please check that the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button disabled={loading} onClick={() => handleExport('html')}>Export HTML</button>
      <button disabled={loading} onClick={() => handleExport('pdf')}>Export PDF</button>
    </div>
  );
}