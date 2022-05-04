import { defineConfig } from 'vitest/config';

const defaultExclude = ['node_modules', 'dist', '.idea', '.git', '.cache'];
export default defineConfig({
  test: {
    globals: true,
    // includeSource: ['./**/composeMessages.ts'],
    exclude: [...defaultExclude, 'lib'],
  },
});
