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
  optimizeDeps: {
    include: [
      // 'algoliasearch',
    ],
    exclude: [
      'svelte-i18n', 'sveltefirets', 'sveltefirets/helpers/loader', 'svelte-pieces',
      'firebase/functions',
      '@sentry/browser',
      // 'instantsearch.js', 'instantsearch.js/es/widgets/index.js', 'instantsearch.js/es/connectors',
    ],
  },
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
};

export default config;
