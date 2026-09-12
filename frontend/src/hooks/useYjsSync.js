// Connects to Yjs WebSocket provider
// TODO: implement

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';

export function useYjsSync(socket, documentId) {
  const yDocRef = useRef(new Y.Doc());
  const [content, setContent] = useState([]);

  useEffect(() => {
    if (!socket || !documentId) return;

    const yDoc = yDocRef.current;
    const yArray = yDoc.getArray('content');

    // Whenever the shared array changes (by us or someone else), update React state
    const syncReactState = () => setContent(yArray.toArray());
    yArray.observe(syncReactState);

    // When WE make a local change, send it to the server
    const sendLocalUpdate = (update, origin) => {
      if (origin === 'remote') return; // don't echo back updates that came FROM the server
      socket.emit('sync-update', { documentId, update: Array.from(update) });
    };
    yDoc.on('update', sendLocalUpdate);

    // Ask the server to join this document's room
    socket.emit('join-document', documentId);

    // Server sends the full current state when we join
    const handleInit = (stateUpdate) => {
      Y.applyUpdate(yDoc, new Uint8Array(stateUpdate), 'remote');
    };
    socket.on('sync-init', handleInit);

    // Server relays other users' edits to us
    const handleRemoteUpdate = (update) => {
      Y.applyUpdate(yDoc, new Uint8Array(update), 'remote');
    };
    socket.on('sync-update', handleRemoteUpdate);

    return () => {
      yArray.unobserve(syncReactState);
      yDoc.off('update', sendLocalUpdate);
      socket.off('sync-init', handleInit);
      socket.off('sync-update', handleRemoteUpdate);
    };
  }, [socket, documentId]);

  const addBlock = useCallback((block) => {
    yDocRef.current.getArray('content').push([block]);
  }, []);

  const updateBlock = useCallback((index, newBlock) => {
    const yArray = yDocRef.current.getArray('content');
    yDocRef.current.transact(() => {
      yArray.delete(index, 1);
      yArray.insert(index, [newBlock]);
    });
  }, []);

  const removeBlock = useCallback((index) => {
    yDocRef.current.getArray('content').delete(index, 1);
  }, []);

  return { content, addBlock, updateBlock, removeBlock };
}