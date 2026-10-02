// Draws other people's cursors and selections on top of a text field.
//
// For each person it renders an invisible copy of the field's text (same font,
// padding and wrapping as the real field) with a coloured caret and a coloured
// highlight placed exactly where that person's cursor or selection is.
import { splitAtCursor } from '../../lib/cursorMath';

export default function CursorOverlay({ users, text, className, singleLine }) {
  if (!users || users.length === 0) return null;

  return (
    <>
      {users.map((user) => {
        const { before, selected, after } = splitAtCursor(text, user.cursor);
        const color = user.color || '#4A90D9';

        return (
          <div
            key={user.socketId}
            className={`${className} doc-cursor-layer${singleLine ? ' single' : ''}`}
            aria-hidden="true"
          >
            <span>{before}</span>
            {selected && (
              <span className="doc-cursor-selection" style={{ background: `${color}55` }}>{selected}</span>
            )}
            <span className="doc-cursor-caret" style={{ borderLeftColor: color }}>
              <span className="doc-cursor-flag" style={{ background: color }}>{user.name}</span>
            </span>
            <span>{after}</span>
            <span>{'\u200b'}</span>
          </div>
        );
      })}
    </>
  );
}