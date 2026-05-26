import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'site/vitest.config.ts',
      'packages/old-site/vitest.config.ts',
      'packages/types/vitest.config.ts',
      'packages/scripts/vitest.config.ts',
      'packages/ids-import/vitest.config.ts',
    ],
  },
})
