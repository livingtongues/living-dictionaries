import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest config — cf-worker is NOT part of the pnpm workspace's
 * test projects (workspaces is for `/site`, `/rn`, `/shared`, `/scripts`).
 * This config exists to override the root `vitest.config.ts`'s `projects`
 * field when running `vitest` from inside `cf-worker/`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
