import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * In dev, when VITE_BACKEND_ORIGIN is unset, the frontend uses relative /api and
 * this proxy so the browser talks only to Vite (:5173). That avoids Windows/WSL
 * split where localhost:5000 hits a different process than 127.0.0.1:5000 in WSL.
 *
 * If Flask runs elsewhere, set VITE_BACKEND_ORIGIN in .env (disables this for API),
 * or set VITE_PROXY_TARGET to your Flask base (e.g. WSL IP from Windows).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000').replace(/\/+$/, '')

  return {
    plugins: [react()],
    build: {
      // Enable source maps so production runtime errors can be traced back to
      // the original source modules during deployment debugging.
      sourcemap: true,
    },
    server: {
      proxy: {
        // Browser calls /api/*; Flask routes are unprefixed (Vercel strips /api in prod).
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '') || '/',
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              console.error('[vite] /api proxy error — is Flask running?', proxyTarget, err?.message || err)
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(
                  JSON.stringify({
                    error: `Cannot reach Flask at ${proxyTarget}. Start: ./scripts/dev/start_backend.sh`,
                  }),
                )
              }
            })
          },
        },
        '/integrations': { target: proxyTarget, changeOrigin: true, secure: false },
        '/wordcloud.png': { target: proxyTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
