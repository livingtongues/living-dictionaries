import { defineConfig } from 'vitest/config'

// run separately `pnpm test:db` from other unit tests because it requires local Supabase running
export default defineConfig({
  test: {
    name: 'database:unit',
    alias: {
      $lib: new URL('./src/lib', import.meta.url).pathname,
    },
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true,
      }
    },
    include: ['src/db-tests/**/*.test.ts'],
  },
})
