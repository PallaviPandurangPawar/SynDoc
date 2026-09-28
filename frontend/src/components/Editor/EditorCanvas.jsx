// Block-based editor surface — content state, add/update/remove, per-block lock badges
import { useEffect, useRef, useState } from 'react';
import { useYjsSync } from '../../hooks/useYjsSync';
import { useLocks } from '../../hooks/useLocks';
import { useAuth } from '../../context/AuthContext';
import Toolbar from './Toolbar';
import Block from './Block';

export default function EditorCanvas({ documentId, socket, updateCursor }) {
  const { user } = useAuth();
  const { content, addBlock, updateBlock, removeBlock } = useYjsSync(socket, documentId);
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
    if (type === 'heading') {
      newBlock.attributes = { level: 1 };
    }
    addBlock(newBlock);
  };

  const handleSetHeadingLevel = (index, block, level) => {
    updateBlock(index, { ...block, attributes: { ...block.attributes, level } });
  };

  return (
    <div className="doc-editor-area">
      <Toolbar onAddBlock={handleAddBlock} blockCount={content.length} saving={saving} />

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
            onFocus={() => { updateCursor({ blockIndex: index }); lockBlock(block.nodeId); }}
            onBlur={() => unlockBlock(block.nodeId)}
            onChange={(updated) => updateBlock(index, updated)}
            onDelete={() => removeBlock(index)}
            onSetHeadingLevel={(level) => handleSetHeadingLevel(index, block, level)}
          />
        );
      })}
    </div>
  );
}