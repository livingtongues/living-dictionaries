import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [
    sveltekit(),
    rawFonts(['.ttf'])
  ],
  resolve: {
    alias: {
      '@living-dictionaries/parts': path.resolve('./src/lib'),
    },
  },
  define: {
    'import.meta.vitest': false,
  },
  test: {
    name: 'parts',
    globals: true,
    includeSource: ['src/**/*.ts'],
  },
});

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