import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
// import { svelte } from '@sveltejs/vite-plugin-svelte';

import { kitbook } from 'kitbook/plugins/vite';

const config: UserConfig = {
  plugins: [
    kitbook(),
    sveltekit(),
  ],

  server: {
    port: 3041,
    strictPort: false,
  },
  build: {
    target: 'es2015',
  },
  define: {
    'import.meta.vitest': false,
    'import.meta.env.VERCEL_ANALYTICS_ID': JSON.stringify(process.env.VERCEL_ANALYTICS_ID),
  },
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
};

export default config;
