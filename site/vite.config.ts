import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import Icons from 'unplugin-icons/vite'
import { sqlite_proxy } from './sqlite-proxy/vite-plugin'
import { raw_fonts } from './vite-plugins/raw-fonts'

// svelte-look is a `link:../../svelte-look` workspace dep that doesn't exist in
// the Docker build context. Import it lazily so a missing target degrades to
// "no story plugin" instead of failing the production build.
async function load_svelte_look() {
  try {
    const { svelte_look } = await import('svelte-look/vite')
    return svelte_look()
  } catch {
    return false
  }
}

export default defineConfig(async (): Promise<UserConfig> => ({
  plugins: [
    await load_svelte_look(),
    // `~icons/<collection>/<name>` → Svelte component (all icons site-wide; reads @iconify/json)
    // scale: 1 → icons render 1em tall (width follows each icon's aspect ratio), so
    // `font-size` on the icon or its parent IS the icon size (default would be 1.2em)
    Icons({ compiler: 'svelte', scale: 1 }),
    sveltekit(),
    raw_fonts(['.ttf']),
    // Dev-only HTTP+WS proxy so the agent CLI (`scripts/sqlite-query.sh`) can
    // query the live browser wa-sqlite DBs (admin shared.db + per-dict dict.db).
    sqlite_proxy(),
  ],
  server: {
    port: 3041,
    strictPort: false,
  },
  build: {
    target: 'es2015',
  },
  worker: {
    format: 'es', // allow code-split chunks to be imported into the worker
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
    ],
    exclude: [ // if the dependency is small, ESM, no CJS imports, then exclude and let the browser load directly - https://vitejs.dev/guide/dep-pre-bundling.html
      'idb-keyval',
      'comlink',
      '@orama/orama',
      '@turf/helpers',
      '@turf/center',
      '@turf/turf',
      'wa-sqlite', // Emscripten loader resolves its .wasm via a relative import.meta.url that pre-bundling breaks
    ],
  },
}))

function getReplacements() {
  return {
    'import.meta.vitest': false,
  }
}
