const WebSocket = require('ws');
const Y = require('yjs');
const yUtils = require('y-websocket/bin/utils');
const crdtService = require('../services/crdtService');
const syncService = require('../services/syncService');
const { authenticateToken } = require('../middlewares/auth');
const { findAccessibleDocument } = require('../middlewares/documentAccess');

let wssInstance = null;
let ioInstance = null;

/**
 * Extracts a document identifier from an incoming URL.
 * Supports /docId, /yjs/docId, /ws/docId, or ?room=docId / ?document=docId
 */
function extractDocName(reqUrl = '') {
  try {
    const parsed = new URL(reqUrl, 'http://localhost');
    let pathname = parsed.pathname.replace(/^\/+/, '');
    if (pathname.startsWith('yjs/')) {
      pathname = pathname.substring(4);
    } else if (pathname.startsWith('ws/')) {
      pathname = pathname.substring(3);
    }
    const docParam = parsed.searchParams.get('room') || 
                     parsed.searchParams.get('document') || 
                     parsed.searchParams.get('doc');
    return docParam || pathname || 'default-doc';
  } catch (err) {
    return 'default-doc';
  }
}

/**
 * Sets up persistence hooks for y-websocket shared docs to integrate
 * with SyncDoc's MongoDB persistence and CRDT service.
 */
function setupYjsPersistence() {
  yUtils.setPersistence({
    bindState: async (docName, ydoc) => {
      // 1. Load initial document state from DB if needed
      await syncService.loadInitialState(docName);

      // 2. Sync state from crdtService's in-memory doc to y-websocket doc
      const existingState = crdtService.getStateAsUpdate(docName);
      if (existingState && existingState.length > 0) {
        Y.applyUpdate(ydoc, existingState, 'initial-sync');
      }

      // 3. Listen for changes made by WebSocket clients
      ydoc.on('update', (update, origin) => {
        // Avoid infinite loop if update originated from socket-io bridge
        if (origin !== 'socket-io' && origin !== 'initial-sync') {
          crdtService.applyUpdate(docName, update);
          syncService.schedulePersist(docName);

          // If Socket.IO is initialized, broadcast to Socket.IO clients in this room
          if (ioInstance) {
            ioInstance.to(docName).emit('sync-update', Array.from(update));
          }
        }
      });
    },
    writeState: async (docName) => {
      await syncService.persistNow(docName);
    }
  });
}

/**
 * Initializes the WebSocket server and hooks it to the HTTP server.
 * @param {import('http').Server} server 
 * @param {import('socket.io').Server} [io]
 */
function initWebSocket(server, io = null) {
  if (io) {
    ioInstance = io;
  }

  setupYjsPersistence();

  const wss = new WebSocket.Server({ noServer: true });
  wssInstance = wss;

  wss.on('connection', (ws, req) => {
    const docName = extractDocName(req.url);
    console.log(`🔌 [WebSocket] Client connected for document: ${docName}`);

    // Delegate connection handling to y-websocket
    yUtils.setupWSConnection(ws, req, { docName });

    ws.on('close', () => {
      console.log(`🔌 [WebSocket] Client disconnected from document: ${docName}`);
    });
  });

  // Attach upgrade handler to HTTP server
  server.on('upgrade', async (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];

    // Let Socket.IO handle its own connections
    if (pathname.startsWith('/socket.io')) {
      return;
    }

    try {
      const parsed = new URL(request.url || '/', 'http://localhost');
      const token = request.headers.authorization?.replace(/^Bearer\s+/, '') ||
        parsed.searchParams.get('token') || parsed.searchParams.get('access_token');
      const user = await authenticateToken(token);
      const docName = extractDocName(request.url);
      const document = await findAccessibleDocument(docName, user);

      if (!document) {
        socket.destroy();
        return;
      }

      request.user = user;
    } catch (error) {
      socket.destroy();
      return;
    }

    // Handle WebSocket connections
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return wss;
}

/**
 * Helper to get the shared doc map from y-websocket
 */
function getYDocs() {
  return yUtils.docs;
}

module.exports = {
  initWebSocket,
  extractDocName,
  getYDocs
};
