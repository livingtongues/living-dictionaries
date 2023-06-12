import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

import { mdsvex } from 'mdsvex';
import mdsvexConfig from './mdsvex.config.js';

import UnoCSS from '@unocss/svelte-scoped/preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', ...mdsvexConfig.extensions],
  preprocess: [
    vitePreprocess(),
    mdsvex(mdsvexConfig),
    UnoCSS({
      options: {
        classPrefix: 'ldp-',
      }
    }),
  ],

  kit: {
    adapter: adapter(),
  },

  onwarn: (warning, handler) => {
    if (warning.code.startsWith('a11y-')) {
      return;
    }
    handler(warning);
  },

  vitePlugin: {
    experimental: {
      inspector: {
        holdMode: true,
      }
    }
  }
};

export default config;
