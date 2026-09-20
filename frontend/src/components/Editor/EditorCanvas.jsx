// Main block-based editor surface
// TODO: implement

import { useSocket } from '../../hooks/useSocket';
import { useYjsSync } from '../../hooks/useYjsSync';
import { usePresence } from '../../hooks/usePresence';
import Toolbar from './Toolbar';
import Block from './Block';
import UserList from '../Presence/UserList';
import CursorOverlay from '../Presence/CursorOverlay';

export default function EditorCanvas({ documentId })
{
  const { socket, connected } = useSocket();
  const { content, addBlock, updateBlock, removeBlock } = useYjsSync(socket, documentId);
  const { activeUsers, updateCursor } = usePresence(socket, documentId, 'You');

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
      {content.map((block, index) => (
        <div key={block.nodeId || index}>
          <CursorOverlay users={activeUsers} blockIndex={index} />
          <div onFocus={() => updateCursor({ blockIndex: index })}>
            <Block block={block} onChange={(updated) => updateBlock(index, updated)} onDelete={() => removeBlock(index)} />
          </div>
        </div>
      ))}
    </div>
  );
}