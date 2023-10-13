import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    rawFonts(['.ttf'])
  ],
  define: {
    'import.meta.vitest': false,
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
