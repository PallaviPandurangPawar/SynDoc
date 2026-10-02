// Individual block renderer — heading, paragraph, code, list, quote, callout, image, divider
import TextField from './TextField';

const LIST_TYPES = [
  { value: 'bullet', label: 'Bullet' },
  { value: 'ordered', label: '1. 2. 3.' },
  { value: 'check', label: 'Checklist' }
];

const CALLOUT_TYPES = [
  { value: 'info', label: 'ℹ️ Info' },
  { value: 'warning', label: '⚠️ Warning' },
  { value: 'success', label: '✅ Success' },
  { value: 'error', label: '❌ Error' }
];

const HEADING_LEVELS = [1, 2, 3, 4].map((lvl) => ({ value: lvl, label: `H${lvl}` }));

const CODE_LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'java',
  'cpp', 'html', 'css', 'json', 'bash', 'sql'
];

// Only allow normal web images in the preview (blocks javascript: and svg tricks)
const isSafeImageSrc = (src = '') =>
  /^https?:\/\//i.test(src) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src);

function ToggleGroup({ label, options, value, onPick, disabled }) {
  return (
    <div className="doc-heading-size-group">
      {label && <span className="doc-heading-size-label">{label}</span>}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          className={`doc-heading-size-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onPick(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Block({
  block,
  disabled,
  editingLabel,
  isSelfEditing,
  remoteCursors,
  onFocus,
  onBlur,
  onCursor,
  onChange,
  onDelete,
  onSetHeadingLevel,
  onSetAttribute
}) {
  const attrs = block.attributes || {};
  const text = block.content ?? '';
  const handleTextChange = (e) => onChange({ ...block, content: e.target.value });

  // Props shared by every text field in this block
  const fieldProps = {
    value: text,
    onChange: handleTextChange,
    onFocus,
    onBlur,
    onCursor,
    remoteCursors,
    disabled
  };

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

  // Shared frame: top bar (badge, tag, controls, delete) + the block body
  const shell = (extraClass, tag, controls, body) => (
    <div className={`doc-block${extraClass ? ` ${extraClass}` : ''}`}>
      <div className="doc-block-topbar">
        <div className="doc-block-topbar-left">
          {badge}
          {tag && <span className="doc-code-tag">{tag}</span>}
          {controls}
        </div>
        {deleteButton}
      </div>
      {body}
    </div>
  );

  switch (block.type) {
    case 'heading': {
      const level = attrs.level || 1;
      const sizeClass = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
      return shell(
        '',
        null,
        <ToggleGroup label="Size:" options={HEADING_LEVELS} value={level} onPick={onSetHeadingLevel} disabled={disabled} />,
        <TextField
          as="input"
          type="text"
          className={`doc-heading-input ${sizeClass}`}
          placeholder="Heading text..."
          {...fieldProps}
        />
      );
    }

    case 'code':
      return shell(
        'code',
        'CODE',
        <select
          className="doc-select"
          value={attrs.language || 'plaintext'}
          disabled={disabled}
          onChange={(e) => onSetAttribute('language', e.target.value)}
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>,
        <TextField
          rows={4}
          className="doc-code-textarea"
          placeholder="// Write code here..."
          {...fieldProps}
        />
      );

    case 'list':
      return shell(
        '',
        'LIST',
        <ToggleGroup options={LIST_TYPES} value={attrs.listType || 'bullet'} onPick={(v) => onSetAttribute('listType', v)} disabled={disabled} />,
        <>
          <TextField
            rows={4}
            className="doc-paragraph-textarea"
            placeholder="One item per line..."
            {...fieldProps}
          />
          {attrs.listType === 'check' && (
            <p className="doc-hint">Start a line with [x] for done or [ ] for not done.</p>
          )}
        </>
      );

    case 'blockquote':
      return shell(
        '',
        'QUOTE',
        null,
        <TextField
          rows={3}
          className="doc-paragraph-textarea doc-quote-textarea"
          placeholder="Quote text..."
          {...fieldProps}
        />
      );

    case 'callout': {
      const calloutType = attrs.calloutType || 'info';
      return shell(
        `callout-block callout-${calloutType}`,
        'CALLOUT',
        <ToggleGroup options={CALLOUT_TYPES} value={calloutType} onPick={(v) => onSetAttribute('calloutType', v)} disabled={disabled} />,
        <TextField
          rows={3}
          className="doc-paragraph-textarea"
          placeholder="Callout message..."
          {...fieldProps}
        />
      );
    }

    case 'image': {
      const src = attrs.src || '';
      return shell(
        '',
        'IMAGE',
        null,
        <>
          <input
            type="url"
            autoComplete="off"
            className="doc-image-input"
            value={src}
            onChange={(e) => onSetAttribute('src', e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={disabled}
            placeholder="Paste an image link (https://...)"
          />
          {src && isSafeImageSrc(src) && (
            <img className="doc-image-preview" src={src} alt={text || 'Image preview'} />
          )}
          {src && !isSafeImageSrc(src) && (
            <p className="doc-hint warn">Only http(s) image links are allowed.</p>
          )}
          <TextField
            as="input"
            type="text"
            className="doc-image-input"
            wrapperClassName="spaced"
            placeholder="Caption / alt text (optional)"
            {...fieldProps}
          />
        </>
      );
    }

    case 'divider':
      return shell('', 'DIVIDER', null, <hr className="doc-divider-preview" />);

    default:
      return shell(
        '',
        null,
        null,
        <TextField
          rows={3}
          className="doc-paragraph-textarea"
          placeholder="Type something..."
          {...fieldProps}
        />
      );
  }
}