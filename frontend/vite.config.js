import { defineConfig, createLogger } from 'vite';

// Hide the harmless "ws proxy" warnings when a browser tab disconnects
const logger = createLogger();
const originalError = logger.error;
logger.error = (msg, options) => {
  if (msg.includes('ws proxy')) return;
  originalError(msg, options);
};
import react from '@vitejs/plugin-react';

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      },
      // Yjs WebSocket (real-time document sync)
      '/yjs': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
});