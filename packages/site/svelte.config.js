import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-auto';

import UnoCSS from 'temp-s-p-u';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    preprocess(),
    UnoCSS({ options: { classPrefix: 'ld-' } }),
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

import { augmentSvelteConfigForKitbook } from 'kitbook/plugins/vite'; 
export default augmentSvelteConfigForKitbook(config);
