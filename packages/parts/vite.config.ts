import { sveltekit } from '@sveltejs/kit/vite';
// import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit(), rawFonts(['.ttf'])],
  // envDir: '../../',
  resolve: {
    alias: {
      '@living-dictionaries/parts': path.resolve('./src/lib'),
    },
  },
  define: {
    'import.meta.vitest': false,
  },
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
};

import fs from 'fs';
function rawFonts(ext) {
	return {
		name: 'vite-plugin-raw-fonts',
		resolveId(id) {
			return ext.some((e) => id.endsWith(e)) ? id : null;
		},
		transform(code, id) {
			if (ext.some((e) => id.endsWith(e))) {
				const buffer = fs.readFileSync(id);
				return { code: `export default ${JSON.stringify(buffer)}`, map: null };
			}
		}
	};
}

export default config;