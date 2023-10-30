// @ts-check
import { vitePreprocess } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.composition'],
  preprocess: [
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
