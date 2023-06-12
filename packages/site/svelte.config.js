import { vitePreprocess } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
    experimental: {
      inspector: {
        holdMode: true,
      }
    }
  }
};

import { augmentSvelteConfigForKitbook } from 'kitbook/plugins/vite'; 
export default augmentSvelteConfigForKitbook(config);
