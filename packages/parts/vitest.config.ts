import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'parts:unit',
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
})
