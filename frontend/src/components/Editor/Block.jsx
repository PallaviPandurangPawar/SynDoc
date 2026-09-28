// Individual block renderer — heading (with size control), paragraph, code
export default function Block({
  block,
  disabled,
  editingLabel,
  isSelfEditing,
  onFocus,
  onBlur,
  onChange,
  onDelete,
  onSetHeadingLevel
}) {
  const handleTextChange = (e) => onChange({ ...block, content: e.target.value });

  const badge = editingLabel ? (
    <span className={`doc-edit-badge${isSelfEditing ? ' self' : ''}`}>
      {editingLabel} editing
    </span>
  ) : null;

  const deleteButton = (
    <button className="doc-block-delete" onClick={onDelete} title="Delete block" aria-label="Delete block">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  );

  if (block.type === 'heading') {
    const level = block.attributes?.level || 1;
    const sizeClass = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';

    return (
      <div className="doc-block">
        <div className="doc-block-topbar">
          <div className="doc-block-topbar-left">
            {badge}
            <div className="doc-heading-size-group">
              <span className="doc-heading-size-label">Size:</span>
              {[1, 2, 3, 4].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`doc-heading-size-btn${level === lvl ? ' active' : ''}`}
                  onClick={() => onSetHeadingLevel(lvl)}
                >
                  H{lvl}
                </button>
              ))}
            </div>
          </div>
          {deleteButton}
        </div>
        <input
          type="text"
          className={`doc-heading-input ${sizeClass}`}
          value={block.content}
          onChange={handleTextChange}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="Heading text..."
        />
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="doc-block code">
        <div className="doc-block-topbar">
          <div className="doc-block-topbar-left">
            {badge}
            <span className="doc-code-tag">CODE</span>
          </div>
          {deleteButton}
        </div>
        <textarea
          rows={4}
          className="doc-code-textarea"
          value={block.content}
          onChange={handleTextChange}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="// Write code here..."
        />
      </div>
    );
  }

  return (
    <div className="doc-block">
      <div className="doc-block-topbar">
        <div className="doc-block-topbar-left">{badge}</div>
        {deleteButton}
      </div>
      <textarea
        rows={3}
        className="doc-paragraph-textarea"
        value={block.content}
        onChange={handleTextChange}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="Type something..."
      />
    </div>
  );
}