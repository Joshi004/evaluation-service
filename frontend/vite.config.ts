import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite listens on 5173 inside the container and printUrls() reports that.
// Compose may publish a different host port (FRONTEND_PORT); wrap printUrls
// so `docker compose up` logs a URL that actually opens in the host browser.
function logPublishedHostUrl(): Plugin {
  const frontendPort = process.env.FRONTEND_PORT ?? '5173'
  const backendPort = process.env.BACKEND_PORT ?? '8000'
  return {
    name: 'log-published-host-url',
    configureServer(server) {
      const printUrls = server.printUrls.bind(server)
      server.printUrls = () => {
        printUrls()
        server.config.logger.info(`  ➜  Host:    http://localhost:${frontendPort}/`)
        server.config.logger.info(`  ➜  API:     http://localhost:${backendPort}/api/v1`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), logPublishedHostUrl()],
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
