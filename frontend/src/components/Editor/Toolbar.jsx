// Add-block controls + block count + connection + save status
const BLOCK_BUTTONS = [
  { type: 'paragraph', label: '+ Paragraph' },
  { type: 'heading', label: '+ Heading' },
  { type: 'code', label: '+ Code' },
  { type: 'list', label: '+ List' },
  { type: 'blockquote', label: '+ Quote' },
  { type: 'callout', label: '+ Callout' },
  { type: 'image', label: '+ Image' },
  { type: 'divider', label: '+ Divider' }
];

export default function Toolbar({ onAddBlock, blockCount, saving, transport }) {
  return (
    <div className="doc-toolbar">
      <div className="doc-toolbar-left">
        <span className="doc-toolbar-label">Add Block:</span>
        {BLOCK_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            className="doc-toolbar-btn"
            onClick={() => onAddBlock(btn.type)}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div className="doc-toolbar-right">
        {transport && (
          <>
            <span
              className={`doc-transport ${transport === 'websocket' ? 'ws' : 'fallback'}`}
              title={transport === 'websocket' ? 'Connected through the Yjs WebSocket' : 'WebSocket unavailable, using the Socket.io backup'}
            >
              {transport === 'websocket' ? '⚡ WebSocket' : '↺ Socket.io'}
            </span>
            <span className="doc-toolbar-dot">•</span>
          </>
        )}
        <span>{blockCount} block{blockCount === 1 ? '' : 's'}</span>
        <span className="doc-toolbar-dot">•</span>
        {saving ? (
          <span className="doc-save-status saving">
            <span className="doc-spinner"></span> Saving...
          </span>
        ) : (
          <span className="doc-save-status saved">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Auto-saved
          </span>
        )}
      </div>
    </div>
  );
}