import preprocess from 'svelte-preprocess';
import vercel from '@sveltejs/adapter-vercel';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: preprocess({
		defaults: {
			sourceMap: true,
			style: 'postcss',
		},
		postcss: true,
		replace: [
			// this will allow us to use as import.meta.env.VERCEL_ANALYTICS_ID
			['import.meta.env.VERCEL_ANALYTICS_ID', JSON.stringify(process.env.VERCEL_ANALYTICS_ID)]
		]
	}),

	kit: {
		adapter: vercel(),
		target: '#svelte',
		vite: {
			resolve: {
				alias: {
					$svelteui: path.resolve('./src/svelteui'),
					$sveltefirets: path.resolve('./src/sveltefirets'),
				}
			},
		},

	}
};

export default config;
