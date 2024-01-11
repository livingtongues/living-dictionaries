import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: {
      $lib: new URL('./src/lib', import.meta.url).pathname,
    },
    name: 'site:unit',
    globals: true,
    includeSource: ['src/**/*.ts'],
    exclude: [...defaultExclude, 'e2e/**'],
  },
})
