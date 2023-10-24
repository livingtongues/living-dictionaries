// @ts-check
import { vitePreprocess } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';
import { mdsvex, KITBOOK_MDSVEX_CONFIG } from 'kitbook/plugins/mdsvex';

const withoutSVX = {
  ...KITBOOK_MDSVEX_CONFIG,
  extensions: ['.md'],
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.composition', '.md'],
  preprocess: [
    mdsvex(withoutSVX),
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
