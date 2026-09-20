// Editor toolbar
// TODO: implement


export default function Toolbar({ onAddBlock }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
      <button onClick={() => onAddBlock('paragraph')}>+ Paragraph</button>
      <button onClick={() => onAddBlock('heading')}>+ Heading</button>
      <button onClick={() => onAddBlock('code')}>+ Code</button>
    </div>
  );
}