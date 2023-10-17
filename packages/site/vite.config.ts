import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import UnoCSS from '@unocss/svelte-scoped/vite';
import { kitbook } from 'kitbook/plugins/vite';

export default defineConfig({
  plugins: [
    kitbook({
      title: 'Living Dictionaries',
      description: 'Svelte Component Documentation and Prototyping Workbench built for Living Dictionaries using Kitbook',
      githubURL: 'https://github.com/livingtongues/living-dictionaries/tree/main/packages/site',
      expandTree: true,
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 768, height: 800 },
      ]
    }),
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
    'REPLACED_WITH_VERCEL_ANALYTICS_ID': process.env.VERCEL_ANALYTICS_ID || '',
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
});
