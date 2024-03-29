import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'scripts:unit',
    globals: true,
    includeSource: ['./migrate-to-supabase/**/*.ts', './import/**/*.ts', './refactor/**/*.ts', './spreadsheet_helpers/**/*.ts'],
  },
});
