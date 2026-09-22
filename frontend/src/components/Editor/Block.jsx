// Individual block renderer (text/code/heading)
// TODO: implement

export default function Block({ block, onChange, onDelete, disabled }) {
  const handleTextChange = (e) => onChange({ ...block, content: e.target.value });

  const renderByType = () => {
    if (block.type === 'heading') {
      return <input value={block.content} onChange={handleTextChange} disabled={disabled} placeholder="Heading" style={{ fontSize: '20px', fontWeight: 'bold', width: '100%', background: disabled ? '#f0f0f0' : 'white' }} />;
    }
    if (block.type === 'code') {
      return <textarea value={block.content} onChange={handleTextChange} disabled={disabled} placeholder="// code" rows={4} style={{ width: '100%', fontFamily: 'monospace', background: disabled ? '#e8e8e8' : '#f5f5f5' }} />;
    }
    return <textarea value={block.content} onChange={handleTextChange} disabled={disabled} placeholder="Type something..." rows={2} style={{ width: '100%', background: disabled ? '#f0f0f0' : 'white' }} />;
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
      <div style={{ flex: 1 }}>{renderByType()}</div>
      <button onClick={onDelete} title="Delete block" style={{ color: 'red' }}>×</button>
    </div>
  );
}