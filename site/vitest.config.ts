import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'site:unit',
    alias: {
      '$lib': new URL('./src/lib', import.meta.url).pathname,
      '$env/dynamic/private': new URL('./src/lib/mocks/env-dynamic-private.ts', import.meta.url).pathname,
      '$env/dynamic/public': new URL('./src/lib/mocks/env-dynamic-public.ts', import.meta.url).pathname,
      '$env/static/private': new URL('./src/lib/mocks/env-static-private.ts', import.meta.url).pathname,
      '$env/static/public': new URL('./src/lib/mocks/env-static-public.ts', import.meta.url).pathname,
      '$app/environment': new URL('./src/lib/mocks/app-environment.ts', import.meta.url).pathname,
    },
    globals: true,
    includeSource: ['src/**/*.ts'],
    exclude: [...defaultExclude, 'e2e/**'],
  },
})
