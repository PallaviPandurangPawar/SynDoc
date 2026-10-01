// Add-block controls + block count + save status
export default function Toolbar({ onAddBlock, blockCount, saving }) {
  return (
    <div className="doc-toolbar">
      <div className="doc-toolbar-left">
        <span className="doc-toolbar-label">Add Block:</span>
        <button type="button" className="doc-toolbar-btn" onClick={() => onAddBlock('paragraph')}>+ Paragraph</button>
        <button type="button" className="doc-toolbar-btn" onClick={() => onAddBlock('heading')}>+ Heading</button>
        <button type="button" className="doc-toolbar-btn" onClick={() => onAddBlock('code')}>+ Code</button>
      </div>
      <div className="doc-toolbar-right">
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