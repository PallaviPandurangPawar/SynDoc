// Block-based editor surface — content state, add/update/remove, per-block lock badges
import { useEffect, useRef, useState } from 'react';
import { useYjsSync } from '../../hooks/useYjsSync';
import { useLocks } from '../../hooks/useLocks';
import { useAuth } from '../../context/AuthContext';
import { useDocument } from '../../context/DocumentContext';
import { cursorsInBlock } from '../../lib/cursorMath';
import Toolbar from './Toolbar';
import Block from './Block';

// Starting attributes for each block type
const DEFAULT_ATTRIBUTES = {
  heading: { level: 1 },
  code: { language: 'plaintext' },
  list: { listType: 'bullet' },
  callout: { calloutType: 'info' },
  image: { src: '' }
};

export default function EditorCanvas({ documentId, socket, activeUsers, updateCursor }) {
  const { user } = useAuth();
  const { setActiveBlockId, setLocalCursor } = useDocument();
  const { content, addBlock, updateBlock, removeBlock, transport } = useYjsSync(socket, documentId);
  const { lockBlock, unlockBlock, isLockedByOther, getLockOwner } = useLocks(socket, documentId, user?.name || 'Anonymous');

  // Lightweight local "Saving.../Auto-saved" indicator, mirroring the debounced
  // save the backend actually performs.
  const [saving, setSaving] = useState(false);
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true; // skip the very first population from the server
      return;
    }
    setSaving(true);
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaving(false), 700);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [content]);

  const handleAddBlock = (type) => {
    const newBlock = { nodeId: crypto.randomUUID(), type, content: '' };
    if (DEFAULT_ATTRIBUTES[type]) {
      newBlock.attributes = { ...DEFAULT_ATTRIBUTES[type] };
    }
    addBlock(newBlock);
  };

  const handleSetAttribute = (block, key, value) => {
    updateBlock({ ...block, attributes: { ...block.attributes, [key]: value } });
  };

  return (
    <div className="doc-editor-area">
      <Toolbar onAddBlock={handleAddBlock} blockCount={content.length} saving={saving} transport={transport} />

      {content.length === 0 && (
        <p className="doc-empty-hint">No blocks yet — add one above to get started.</p>
      )}

      {content.map((block, index) => {
        const lockedByOther = isLockedByOther(block.nodeId);
        const lockOwner = getLockOwner(block.nodeId);
        const isSelfEditing = Boolean(lockOwner) && !lockedByOther;

        return (
          <Block
            key={block.nodeId || index}
            block={block}
            disabled={lockedByOther}
            editingLabel={lockOwner}
            isSelfEditing={isSelfEditing}
            remoteCursors={cursorsInBlock(activeUsers, block.nodeId, socket?.id)}
            onFocus={() => { lockBlock(block.nodeId); setActiveBlockId(block.nodeId); }}
            onBlur={() => {
              unlockBlock(block.nodeId);
              setActiveBlockId(null);
              setLocalCursor(null);
              updateCursor(null);
            }}
            onCursor={(start, end) => {
              setLocalCursor({ nodeId: block.nodeId, start, end });
              updateCursor({ blockIndex: index, nodeId: block.nodeId, start, end });
            }}
            onChange={(updated) => updateBlock(updated)}
            onDelete={() => removeBlock(block.nodeId)}
            onSetHeadingLevel={(level) => handleSetAttribute(block, 'level', level)}
            onSetAttribute={(key, value) => handleSetAttribute(block, key, value)}
          />
        );
      })}
    </div>
  );
}