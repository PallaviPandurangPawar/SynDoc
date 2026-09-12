// Presence tracking hook
// TODO: implement


import { useEffect, useState, useCallback } from 'react';

export function usePresence(socket, documentId, userName) {
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!socket || !documentId) return;

    const color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    socket.emit('presence-join', { documentId, name: userName || 'Anonymous', color });

    const handleUpdate = (users) => setActiveUsers(users);
    socket.on('presence-update', handleUpdate);

    return () => socket.off('presence-update', handleUpdate);
  }, [socket, documentId, userName]);

  const updateCursor = useCallback((cursor) => {
    if (!socket || !documentId) return;
    socket.emit('presence-cursor', { documentId, cursor });
  }, [socket, documentId]);

  return { activeUsers, updateCursor };
}