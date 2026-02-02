import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  plugins: [svelte()],
  test: {
    name: 'site:unit',
    alias: {
      $lib: new URL('./src/lib', import.meta.url).pathname,
    },
    globals: true,
    includeSource: ['src/**/*.ts'],
    exclude: [...defaultExclude, 'e2e/**', 'src/db-tests/**'],
  },
})
