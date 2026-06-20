import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // On GitHub Pages the app is served from https://<user>.github.io/HaptiQ/,
  // so production assets need that base. Local dev stays at root.
  base: command === 'build' ? '/HaptiQ/' : '/',
  // Expose the dev server on the LAN so a phone can reach it for testing.
  server: { host: true, port: 5173 },
}))
