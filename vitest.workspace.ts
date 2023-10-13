import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/site/vitest.config.ts',
  'packages/parts/vitest.config.ts',
  'packages/scripts/vitest.config.ts',
  'packages/functions/vitest.config.ts',
  'packages/ids-import/vitest.config.ts',
])
