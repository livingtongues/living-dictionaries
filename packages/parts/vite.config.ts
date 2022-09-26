import { sveltekit } from '@sveltejs/kit/vite';
// import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  // envDir: '../../',
  resolve: {
    alias: {
      '@living-dictionaries/parts': path.resolve('./src/lib'),
    },
  },
  define: {
    'import.meta.vitest': false,
  },
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
};

export default config;