import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'functions',
    globals: true,
    // includeSource: ['./src/**/*.ts'],
    include: ['./src/**/*.test.ts'],
    // exclude: [...defaultExclude, 'lib'],
  },
});
