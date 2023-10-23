import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import UnoCSS from '@unocss/svelte-scoped/vite';
import { kitbook } from 'kitbook/plugins/vite';
import kitbookConfig from './kitbook.config';

export default defineConfig({
  plugins: [
    kitbook(kitbookConfig),
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
  define: getReplacements(),
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
});

function getReplacements() {
  if (typeof process !== 'undefined' && process.env.VERCEL_ANALYTICS_ID) {
    return {
      'import.meta.vitest': false,
      'REPLACED_WITH_VERCEL_ANALYTICS_ID': process.env.VERCEL_ANALYTICS_ID,
    }
  }

  return {
    'import.meta.vitest': false,
  }
}
