import { defineConfig } from 'vitest/config'

// run separately from other unit tests because it requires local Supabase running
export default defineConfig({
  test: {
    name: 'scripts:import',
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    include: ['import/**/*.test.ts'],
  },
})
