// Main block-based editor surface
// TODO: implement

import { useSocket } from '../../hooks/useSocket';
import { useYjsSync } from '../../hooks/useYjsSync';
import { usePresence } from '../../hooks/usePresence';
import { useLocks } from '../../hooks/useLocks';
import { useAuth } from '../../context/AuthContext';
import Toolbar from './Toolbar';
import Block from './Block';
import UserList from '../Presence/UserList';
import CursorOverlay from '../Presence/CursorOverlay';

export default function EditorCanvas({ documentId })
{
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const { content, addBlock, updateBlock, removeBlock } = useYjsSync(socket, documentId);
  const { activeUsers, updateCursor } = usePresence(socket, documentId, user?.name || 'Anonymous');
  const { lockBlock, unlockBlock, isLockedByOther, getLockOwner } = useLocks(socket, documentId, user?.name || 'Anonymous');

  const handleAddBlock = (type) => {
  const newBlock = { nodeId: crypto.randomUUID(), type, content: '' };
  if (type === 'heading') {
    newBlock.attributes = { level: 1 };
  }
  addBlock(newBlock);
};

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <div style={{ fontSize: '12px', color: connected ? 'green' : 'red', marginBottom: '8px' }}>
        {connected ? '● Connected' : '○ Connecting...'}
      </div>
      <UserList users={activeUsers} />
      <Toolbar onAddBlock={handleAddBlock} />
      {content.length === 0 && <p style={{ color: '#999' }}>No blocks yet — add one above.</p>}
      {content.map((block, index) => {
        const lockedByOther = isLockedByOther(block.nodeId);
        const lockOwner = getLockOwner(block.nodeId);
        return (
          <div key={block.nodeId || index}>
            <CursorOverlay users={activeUsers} blockIndex={index} />
            {lockedByOther && (
              <div style={{ fontSize: '11px', color: '#c0392b', marginBottom: '2px' }}>
                🔒 Locked by {lockOwner}
              </div>
            )}
            <div
              onFocus={() => { updateCursor({ blockIndex: index }); lockBlock(block.nodeId); }}
              onBlur={() => unlockBlock(block.nodeId)}
            >
              <Block
                block={block}
                onChange={(updated) => updateBlock(index, updated)}
                onDelete={() => removeBlock(index)}
                disabled={lockedByOther}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}