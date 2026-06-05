import { readFileSync } from 'node:fs'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import UnoCSS from 'unocss/vite'
import { svelte_look } from 'svelte-look/vite'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  plugins: [
    svelte_look(),
    UnoCSS(),
    // `~icons/<collection>/<name>` → Svelte component (used by the ported /admin section).
    // Coexists with UnoCSS presetIcons (`class="i-*"`); both read @iconify/json.
    Icons({ compiler: 'svelte' }),
    sveltekit(),
    rawFonts(['.ttf']),
  ],
  server: {
    port: 3041,
    strictPort: false,
  },
  build: {
    target: 'es2015',
  },
  worker: {
    format: 'es', // to allow code-splitted supabase to be imported into the worker
  },
  ssr: {
    external: ['better-sqlite3'], // native module: keep external so adapter-node doesn't inline its bindings loader
  },
  define: getReplacements(),
  optimizeDeps: {
    include: [ // if the dependency is large with many internal modules or is CommonJS then include it
      'xss',
      'wavesurfer.js',
      'recordrtc',
      '@supabase/supabase-js',
    ],
    exclude: [ // if the dependency is small, ESM, no CJS imports, then exclude and let the browser load directly - https://vitejs.dev/guide/dep-pre-bundling.html
      'idb-keyval',
      'comlink',
      '@orama/orama',
      '@turf/helpers',
      '@turf/center',
      '@turf/turf',
      'sveltefirets',
      '@sentry/browser',
      'wa-sqlite', // Emscripten loader resolves its .wasm via a relative import.meta.url that pre-bundling breaks
    ],
  },
})

function getReplacements() {
  if (typeof process !== 'undefined' && process.env.VERCEL_ANALYTICS_ID) {
    return {
      'import.meta.vitest': false,
      'REPLACED_WITH_VERCEL_ANALYTICS_ID': process.env.VERCEL_ANALYTICS_ID,
    }
  }

  return {
    'import.meta.vitest': false,
  }
}

function rawFonts(extensions: string[]): Plugin {
  return {
    name: 'vite-plugin-raw-fonts',
    resolveId(id) {
      return extensions.some(ext => id.endsWith(ext)) ? id : null
    },
    transform(code, id) {
      if (extensions.some(ext => id.endsWith(ext))) {
        const buffer = readFileSync(id)
        return { code: `export default ${JSON.stringify(buffer)}`, map: null }
      }
    },
  }
}
