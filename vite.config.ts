import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/gommo': {
          target: 'https://api.gommo.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gommo/, '')
        }
      }
    },
    define: {
      // Vital: This enables the app to access process.env.API_KEY in the browser
      // by replacing it with the actual value during the build process.
      // Fix: Ensure it returns a string even if env.API_KEY is undefined on Vercel
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    }
  }
})