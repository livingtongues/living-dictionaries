import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // includeSource: ['./src/**/*.ts'],
    include: ['./src/**/*.test.ts'],
    // exclude: [...defaultExclude, 'lib'],
  },
});
