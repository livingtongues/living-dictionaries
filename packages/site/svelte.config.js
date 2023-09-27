// @ts-check
import { vitePreprocess } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';
import { mdsvex, MDSVEX_EXTENSIONS, KITBOOK_MDSVEX_CONFIG } from 'kitbook/plugins/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', ...MDSVEX_EXTENSIONS],
  preprocess: [
    mdsvex(KITBOOK_MDSVEX_CONFIG),
    vitePreprocess(),
  ],

  kit: {
    adapter: adapter(),
  },

  onwarn: (warning, handler) => {
    if (warning.code.startsWith('a11y-'))
      return;

    handler(warning);
  },

  vitePlugin: {
    inspector: {
      holdMode: true,
    }
  }
};

export default config;
