import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import UnoCSS from '@unocss/svelte-scoped/vite'
// import { svelte } from '@sveltejs/vite-plugin-svelte';

import { kitbook } from 'kitbook/plugins/vite';
import type { UserConfig as VitestUserConfigInterface } from 'vitest/config';

const vitestConfig: VitestUserConfigInterface = {
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    includeSource: ['src/**/*.ts'],
  }
};

const config: UserConfig = {
  plugins: [
    kitbook(),
    UnoCSS({
      injectReset: '@unocss/reset/tailwind.css',
    }),
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
      // 'firebase/functions', // broke things when put in exclude - investigate later if it's helpful to put here when using Kitbook
    ],
    exclude: [
      'svelte-i18n', 
      'sveltefirets', 
      'svelte-pieces',
      '@sentry/browser',
      // 'instantsearch.js', 'instantsearch.js/es/widgets/index.js', 'instantsearch.js/es/connectors',
    ],
  },
  // @ts-ignore - adding /// <reference types="vitest" /> doesn't seem to solve
  test: vitestConfig.test,
};

export default config;
