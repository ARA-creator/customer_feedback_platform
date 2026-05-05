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
    server: {
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true, secure: false },
        '/integrations': { target: proxyTarget, changeOrigin: true, secure: false },
        '/wordcloud.png': { target: proxyTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
