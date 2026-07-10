import { defaultExclude, defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import Icons from 'unplugin-icons/vite'

const alias = {
  '$lib': new URL('./src/lib', import.meta.url).pathname,
  '$api': new URL('./src/routes/api', import.meta.url).pathname,
  '$env/dynamic/private': new URL('./src/lib/mocks/env-dynamic-private.ts', import.meta.url).pathname,
  '$env/dynamic/public': new URL('./src/lib/mocks/env-dynamic-public.ts', import.meta.url).pathname,
  '$env/static/private': new URL('./src/lib/mocks/env-static-private.ts', import.meta.url).pathname,
  '$env/static/public': new URL('./src/lib/mocks/env-static-public.ts', import.meta.url).pathname,
  '$app/environment': new URL('./src/lib/mocks/app-environment.ts', import.meta.url).pathname,
}

export default defineConfig({
  test: {
    projects: [
      {
        // Node project: pure TS units + in-source tests. Keeps vite-plugin-svelte
        // so `.svelte` imports compile for SSR (tests exercising `svelte/server`
        // render, e.g. email) — but still excludes the `.svelte.test.ts` reactive
        // suite, which needs the browser resolve condition below.
        plugins: [svelte()],
        test: {
          name: 'unit',
          alias,
          globals: true,
          includeSource: ['src/**/*.ts'],
          exclude: [...defaultExclude, 'e2e/**', 'src/**/*.svelte.test.ts'],
        },
      },
      {
        // Reactive project: compiles `.svelte`/`.svelte.ts` runes and runs under
        // happy-dom with the browser resolve condition so `$effect`/`$state`/
        // `$effect.root` + `flushSync` actually execute. Mocks `$app/state` +
        // `$app/navigation` so URL-driven stores/components can be driven directly.
        plugins: [svelte(), Icons({ compiler: 'svelte' })],
        resolve: { conditions: ['browser'] },
        test: {
          name: 'reactive',
          environment: 'happy-dom',
          alias: {
            ...alias,
            '$app/state': new URL('./src/lib/mocks/app-state.svelte.ts', import.meta.url).pathname,
            '$app/navigation': new URL('./src/lib/mocks/app-navigation.ts', import.meta.url).pathname,
          },
          globals: true,
          include: ['src/**/*.svelte.test.ts'],
        },
      },
    ],
  },
})
