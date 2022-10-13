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

	vitePlugin: {
		experimental: {
			inspector: true
		}
	}
};

export default config;
