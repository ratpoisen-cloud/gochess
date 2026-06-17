/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          if (id.includes('/lib/engine/')) {
            return 'engine'
          }
          if (id.includes('/lib/spellChessEngine')) {
            return 'spell'
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: ['.', '.opencode'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
