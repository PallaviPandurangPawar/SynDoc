// Where the editor finds the backend.
//
// In development the Vite proxy (vite.config.js) forwards "/api", "/socket.io"
// and "/yjs" to the backend on port 5000, so no address is typed here.
// For a live website where the backend lives at a different address, set these
// in frontend/.env (all three are optional):
//   VITE_API_URL=https://api.yoursite.com/api
//   VITE_SOCKET_URL=https://api.yoursite.com
//   VITE_WS_URL=wss://api.yoursite.com/yjs
const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined; // undefined = same address as the page
export const WS_URL = import.meta.env.VITE_WS_URL || `${wsScheme}://${window.location.host}/yjs`;