import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-auto';

import deepWind from "svelte-deep-wind-preprocess";
import { windi } from "svelte-windicss-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	experimental: {
		inspector: true // use by pressing Ctrl + Shift and hovering over the component
	},

	preprocess: [
		preprocess({
			replace: [
				// this will allow us to use as import.meta.env.VERCEL_ANALYTICS_ID
				['import.meta.env.VERCEL_ANALYTICS_ID', JSON.stringify(process.env.VERCEL_ANALYTICS_ID)]
			]
		}),
		deepWind({ rtl: true }),
		windi({
			configPath: './windi.config.js',
			experimental: {
				icons: {
					prefix: 'i-',
					extraProperties: {
						'display': 'inline-block',
						'vertical-align': 'middle',
					}
				}
			}
		}),
	],

	kit: {
		adapter: adapter(),
		vite: {
			envDir: '../../',
		},

	}
};

export default config;
