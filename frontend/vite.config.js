import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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