import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'scripts:unit',
    globals: true,
    includeSource: ['./import/**/*.ts', './refactor/**/*.ts', './spreadsheet_helpers/**/*.ts'],
    exclude: [...defaultExclude, 'migrate-to-supabase/**'],
  },
})
