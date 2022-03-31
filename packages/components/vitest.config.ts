import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    includeSource: ['src/lib/helpers/**/*.ts'],
    exclude: [...configDefaults.exclude, '**/tests/**'],
  },
});
