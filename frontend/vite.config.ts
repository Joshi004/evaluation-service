import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // macOS bind mounts through Docker Desktop don't always propagate file
    // change events reliably, so hot reload needs polling in dev.
    watch: {
      usePolling: true,
    },
    proxy: {
      // The backend container is reached by its compose service name.
      // Proxying here (rather than calling it directly from the browser)
      // avoids any CORS setup in dev.
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
