
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html')
      }
    }
  }
})
