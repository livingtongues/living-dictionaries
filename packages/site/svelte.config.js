import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// experimental: {
	// 	inspector: true // use by pressing Ctrl + Shift and hovering over the component
	// },

	preprocess: [
		preprocess(),
	],

	kit: {
		adapter: adapter(),
	}
};

export default config;
