import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // includeSource: ['./**/composeMessages.ts'],
  },
});
