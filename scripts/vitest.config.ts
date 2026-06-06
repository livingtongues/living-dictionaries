import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'scripts:unit',
    globals: true,
    includeSource: ['./import/**/*.ts', './spreadsheet_helpers/**/*.ts'],
    exclude: [...defaultExclude, 'import/**'],
  },
})
