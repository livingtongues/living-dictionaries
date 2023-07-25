import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'functions:unit',
    globals: true,
    // includeSource: ['./src/**/*.ts'],
    include: ['./src/**/*.test.ts'],
    // exclude: [...defaultExclude, 'lib'],
  },
});
