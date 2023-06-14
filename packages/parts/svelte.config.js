import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

import UnoCSS from '@unocss/svelte-scoped/preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    vitePreprocess(),
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
