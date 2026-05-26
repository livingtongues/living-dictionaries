import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

/**
 * Vitest-only config.
 *
 * Deliberately separate from `vite.config.ts` so we DON'T load:
 *   - SvelteKit's vite plugin (`sveltekit()`) — it eagerly reads `.env` into
 *     `process.env` at config-init time. Tests want `process.env` clean so
 *     `vi.mock('$env/dynamic/private', () => ({ env: { X: 'test-value' } }))`
 *     wins, and tests that set `process.env.X` directly in `beforeAll` start
 *     from a known state instead of inheriting whatever was in `.env`.
 *   - UnoCSS / svelte-look plugins — not needed for unit testing.
 *
 * Keeps `vite-plugin-svelte` so component imports (`.svelte` files) compile.
 */
export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    includeSource: ['src/**/*.{js,ts}'],
    alias: {
      '$lib': new URL('./src/lib', import.meta.url).pathname,
      '$api': new URL('./src/routes/api', import.meta.url).pathname,
      // SvelteKit's $env/* virtual modules don't exist outside `sveltekit()`'s
      // resolver. Alias to mock files (see lib/mocks/).
      '$env/dynamic/private': new URL('./src/lib/mocks/env-dynamic-private.ts', import.meta.url).pathname,
      '$env/dynamic/public': new URL('./src/lib/mocks/env-dynamic-public.ts', import.meta.url).pathname,
      '$env/static/public': new URL('./src/lib/mocks/env-static-public.ts', import.meta.url).pathname,
      '$app/environment': new URL('./src/lib/mocks/app-environment.ts', import.meta.url).pathname,
    },
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  ssr: {
    external: ['better-sqlite3'],
  },
})
