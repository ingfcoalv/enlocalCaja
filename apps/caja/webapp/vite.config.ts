import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@enlocal/react-components': resolve(__dirname, '../../../packages/react-components/src/index.ts'),
      '@enlocal/react-hooks': resolve(__dirname, '../../../packages/react-hooks/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8214',
        changeOrigin: true,
      },
    },
  },
})
