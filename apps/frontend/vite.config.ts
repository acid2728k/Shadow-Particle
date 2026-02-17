import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@sp/protocol': path.resolve(__dirname, '../../shared/protocol/src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
