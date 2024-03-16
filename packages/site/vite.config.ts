import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import UnoCSS from '@unocss/svelte-scoped/vite';
import { kitbook } from 'kitbook/plugins/vite';
import kitbookConfig from './kitbook.config';
import { readFileSync } from 'fs';

export default defineConfig({
  plugins: [
    kitbook(kitbookConfig),
    UnoCSS({
      injectReset: '@unocss/reset/tailwind.css',
    }),
    sveltekit(),
    rawFonts(['.ttf']),
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

function rawFonts(extensions: string[]): Plugin {
  return {
    name: 'vite-plugin-raw-fonts',
    resolveId(id) {
      return extensions.some((ext) => id.endsWith(ext)) ? id : null;
    },
    transform(code, id) {
      if (extensions.some((ext) => id.endsWith(ext))) {
        const buffer = readFileSync(id);
        return { code: `export default ${JSON.stringify(buffer)}`, map: null };
      }
    }
  };
}
