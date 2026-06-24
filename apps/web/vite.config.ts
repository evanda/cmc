import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // The repo keeps a single .env at the monorepo root (one per deployment).
  // Load env from there so `pnpm --filter @cmc/web dev` Just Works without
  // exporting vars into the shell. Only VITE_*-prefixed vars reach the client.
  envDir: '../../',
  build: {
    rollupOptions: {
      output: {
        // MapLibre GL JS is ~2 MB — split it so the app chunk stays cacheable.
        manualChunks: { maplibre: ['maplibre-gl'] },
      },
    },
  },
});
