/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Files in public/ are copied verbatim, so they cannot use Vite's %BASE_URL%
// placeholder. Substitute build-time values on the way out instead:
//  - 404.html needs the deployment base for its SPA redirect
//  - sw.js needs a cache version so that a deploy invalidates the static cache
function injectBuildConstants(base: string): Plugin {
  const version = String(Date.now())
  return {
    name: 'gochess-inject-build-constants',
    apply: 'build',
    closeBundle() {
      const replace = (file: string, pairs: [string, string][]) => {
        const full = path.resolve(__dirname, 'dist', file)
        if (!fs.existsSync(full)) return
        let content = fs.readFileSync(full, 'utf8')
        for (const [from, to] of pairs) {
          content = content.split(from).join(to)
        }
        fs.writeFileSync(full, content)
      }

      replace('404.html', [['__GOCHESS_BASE__', base]])
      replace('sw.js', [
        ['__GOCHESS_VERSION__', version],
        ['__GOCHESS_BASE__', base],
      ])
    },
  }
}

export default defineConfig(() => {
  const base = process.env.VITE_BASE || '/'
  return {
    base,
    plugins: [react(), injectBuildConstants(base)],
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
  }
})
