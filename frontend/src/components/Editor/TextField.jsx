// A text field (textarea or single-line input) that
//  - reports where the user's cursor / selection is, and
//  - draws other people's cursors on top of it.
import { useLayoutEffect, useRef } from 'react';
import CursorOverlay from '../Presence/CursorOverlay';

export default function TextField({
  as = 'textarea',
  className,
  wrapperClassName = '',
  value,
  onChange,
  onFocus,
  onBlur,
  onCursor,
  remoteCursors,
  ...rest
}) {
  const fieldRef = useRef(null);
  const lastReported = useRef({ start: -1, end: -1 });
  const Tag = as;

  // A textarea grows with its text, so it never scrolls inside itself and the
  // cursor overlay always lines up with the real text.
  const fitHeight = () => {
    const el = fieldRef.current;
    if (!el || as !== 'textarea') return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  };
  useLayoutEffect(fitHeight, [value]);
  useLayoutEffect(() => {
    window.addEventListener('resize', fitHeight);
    return () => window.removeEventListener('resize', fitHeight);
  }, []);

  // Tell the server where the cursor / selection is (only when it changed)
  const reportCursor = (force) => {
    const el = fieldRef.current;
    if (!el || !onCursor) return;
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    if (!force && lastReported.current.start === start && lastReported.current.end === end) return;
    lastReported.current = { start, end };
    onCursor(start, end);
  };

  return (
    <div className={`doc-field-wrap ${wrapperClassName}`.trim()}>
      <Tag
        ref={fieldRef}
        className={className}
        value={value}
        onChange={(e) => { if (onChange) onChange(e); reportCursor(false); }}
        onFocus={(e) => { if (onFocus) onFocus(e); reportCursor(true); }}
        onBlur={(e) => { lastReported.current = { start: -1, end: -1 }; if (onBlur) onBlur(e); }}
        onSelect={() => reportCursor(false)}
        onKeyUp={() => reportCursor(false)}
        onMouseUp={() => reportCursor(false)}
        autoComplete="off"
        {...rest}
      />
      <CursorOverlay
        users={remoteCursors}
        text={value}
        className={className}
        singleLine={as === 'input'}
      />
    </div>
  );
}