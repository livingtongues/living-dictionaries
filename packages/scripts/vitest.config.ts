import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'scripts',
    globals: true,
    includeSource: ['./import/**/*.ts', './refactor/**/*.ts', './spreadsheet_helpers/**/*.ts'],
  },
});
