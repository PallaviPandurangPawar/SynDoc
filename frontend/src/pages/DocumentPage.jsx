// Main document editing page
// TODO: implement

import { useParams } from 'react-router-dom';
import EditorCanvas from '../components/Editor/EditorCanvas';
import ExportButton from '../components/Export/ExportButton';

export default function DocumentPage() 
{
  const { id } = useParams();
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
        <ExportButton documentId={id} />
      </div>
      <EditorCanvas documentId={id} />
    </div>
  );
}
