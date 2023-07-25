import { defineProject } from 'vitest/config'
import path from 'node:path'

export default defineProject({
  test: {
    alias: {
      '@living-dictionaries/parts': path.resolve('./src/lib'),
    },
    name: 'parts:unit',
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
})
