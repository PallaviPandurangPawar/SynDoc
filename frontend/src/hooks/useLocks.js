// Block locking hook
import { useEffect, useState, useCallback, useRef } from 'react';

export function useLocks(socket, documentId, userName) {
  const [locks, setLocks] = useState([]);
  const heldLocksRef = useRef(new Set());

  useEffect(() => {
    if (!socket || !documentId) return;

    const handleLockUpdate = (updatedLocks) => setLocks(updatedLocks);
    const handleLockDenied = ({ nodeId, lockedBy }) => {
      heldLocksRef.current.delete(nodeId);
      alert(`This block is currently being edited by ${lockedBy}.`);
    };

    socket.on('lock-update', handleLockUpdate);
    socket.on('lock-denied', handleLockDenied);

    return () => {
      socket.off('lock-update', handleLockUpdate);
      socket.off('lock-denied', handleLockDenied);
    };
  }, [socket, documentId]);

  const lockBlock = useCallback((nodeId) => {
    if (!socket || !documentId) return;
    heldLocksRef.current.add(nodeId);
    socket.emit('lock-block', { documentId, nodeId, userName: userName || 'Anonymous' });
  }, [socket, documentId, userName]);

  const unlockBlock = useCallback((nodeId) => {
    if (!socket || !documentId) return;
    heldLocksRef.current.delete(nodeId);
    socket.emit('unlock-block', { documentId, nodeId });
  }, [socket, documentId]);

  const isLockedByOther = useCallback((nodeId) => {
    const lock = locks.find((l) => l.nodeId === nodeId);
    if (!lock) return false;
    return !heldLocksRef.current.has(nodeId);
  }, [locks]);

  const getLockOwner = useCallback((nodeId) => {
    const lock = locks.find((l) => l.nodeId === nodeId);
    return lock ? lock.userName : null;
  }, [locks]);

  return { locks, lockBlock, unlockBlock, isLockedByOther, getLockOwner };
}