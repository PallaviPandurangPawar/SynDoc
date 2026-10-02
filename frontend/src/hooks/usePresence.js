// Tracks who is in the document and where their cursors are.
import { useEffect, useState, useCallback } from 'react';

// Readable colours that work on both the dark and the light theme
const PALETTE = ['#4A90D9', '#E67E22', '#2ECC71', '#E74C3C', '#9B59B6', '#1ABC9C', '#F39C12', '#E91E63'];

// The same name always gets the same colour, in every session and on every device
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function usePresence(socket, documentId, userName) {
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!socket || !documentId) return undefined;

    const name = userName || 'Anonymous';
    const color = colorForName(name);

    // Announce ourselves now, and again whenever the connection comes back
    // (after a network drop the server has forgotten this browser tab)
    const join = () => socket.emit('presence-join', { documentId, name, color });
    if (socket.connected) join();
    socket.on('connect', join);

    const handleUpdate = (users) => setActiveUsers(users);
    socket.on('presence-update', handleUpdate);

    return () => {
      socket.off('connect', join);
      socket.off('presence-update', handleUpdate);
    };
  }, [socket, documentId, userName]);

  // cursor = { blockIndex, nodeId, start, end }, or null when no field is focused
  const updateCursor = useCallback((cursor) => {
    if (!socket || !documentId) return;
    socket.emit('presence-cursor', { documentId, cursor });
  }, [socket, documentId]);

  return { activeUsers, updateCursor };
}