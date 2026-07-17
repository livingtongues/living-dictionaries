import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'scripts:unit',
    globals: true,
    includeSource: ['./spreadsheet_helpers/**/*.ts'],
    exclude: [...defaultExclude],
  },
})
