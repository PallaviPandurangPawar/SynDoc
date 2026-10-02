// Keeps the editor's blocks in sync with the server through Yjs (CRDT).
//
// Main route:  WebSocket (y-websocket) — fast and carries only small changes.
// Backup route: Socket.io — used automatically whenever the WebSocket is down.
// Both routes feed the same Yjs document, and Yjs ignores duplicates, so the
// two can never disagree.
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_URL } from '../config';
import { addBlockToDoc, updateBlockInDoc, removeBlockFromDoc } from '../lib/yBlocks';

export function useYjsSync(socket, documentId) {
  const yDocRef = useRef(null);
  if (!yDocRef.current) yDocRef.current = new Y.Doc();

  const [content, setContent] = useState([]);
  const [transport, setTransport] = useState('socket.io'); // 'websocket' | 'socket.io'

  useEffect(() => {
    if (!socket || !documentId) return undefined;

    const yDoc = yDocRef.current;
    const yArray = yDoc.getArray('content');

    // Whenever any block or any block's text changes (by us or someone else),
    // refresh what React shows. observeDeep also reports changes inside a block's text.
    const syncReactState = () => setContent(yArray.toJSON());
    yArray.observeDeep(syncReactState);

    // ── Main route: Yjs WebSocket (needs the same login token as everything else) ──
    const token = localStorage.getItem('syncdoc_token') || '';
    const provider = new WebsocketProvider(WS_URL, documentId, yDoc, {
      params: { token },
      disableBc: true // all tabs go through the server so locks and saving always apply
    });
    const handleStatus = ({ status }) => {
      setTransport(status === 'connected' ? 'websocket' : 'socket.io');
    };
    provider.on('status', handleStatus);

    // ── Backup route: Socket.io ──
    // Send our local changes over Socket.io only while the WebSocket is down
    const sendLocalUpdate = (update, origin) => {
      if (origin === 'remote' || origin === provider) return; // came from the network, don't send back
      if (provider.wsconnected) return;                       // the WebSocket provider sends it
      if (!socket.connected) return;                          // offline: re-sent after reconnecting (see handleInit)
      socket.emit('sync-update', { documentId, update: Array.from(update) });
    };
    yDoc.on('update', sendLocalUpdate);

    // Join this document's room now, and again whenever the connection comes back
    const joinDocument = () => socket.emit('join-document', documentId);
    if (socket.connected) joinDocument();
    socket.on('connect', joinDocument);

    // Server sends the full current state when we join
    const handleInit = (stateUpdate) => {
      const serverState = new Uint8Array(stateUpdate);
      Y.applyUpdate(yDoc, serverState, 'remote');

      // Send back anything we have that the server does not (edits typed while offline)
      const missing = Y.encodeStateAsUpdate(yDoc, Y.encodeStateVectorFromUpdate(serverState));
      if (missing.length > 2) {
        socket.emit('sync-update', { documentId, update: Array.from(missing) });
      }
    };
    socket.on('sync-init', handleInit);

    // Server relays other users' edits to us
    const handleRemoteUpdate = (update) => {
      Y.applyUpdate(yDoc, new Uint8Array(update), 'remote');
    };
    socket.on('sync-update', handleRemoteUpdate);

    return () => {
      yArray.unobserveDeep(syncReactState);
      provider.off('status', handleStatus);
      provider.destroy();
      yDoc.off('update', sendLocalUpdate);
      socket.off('connect', joinDocument);
      socket.off('sync-init', handleInit);
      socket.off('sync-update', handleRemoteUpdate);
    };
  }, [socket, documentId]);

  const addBlock = useCallback((block) => {
    addBlockToDoc(yDocRef.current, block);
  }, []);

  // `block` is the edited block (same nodeId). Only the changed characters are sent.
  const updateBlock = useCallback((block) => {
    updateBlockInDoc(yDocRef.current, block);
  }, []);

  const removeBlock = useCallback((nodeId) => {
    removeBlockFromDoc(yDocRef.current, nodeId);
  }, []);

  return { content, addBlock, updateBlock, removeBlock, transport };
}