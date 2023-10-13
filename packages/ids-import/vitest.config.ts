import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'ids-import:unit',
    globals: true,
    includeSource: ['./helpers.ts'],
  },
});
