import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Turn a font import into the file's raw bytes at build time, so server code can
 * hand the buffer straight to satori (`/og` share cards). Shared by
 * `vite.config.ts` and `vitest.config.ts` — without it under vitest the import
 * resolves to an asset URL STRING, and a test that actually rasterizes a card
 * would be feeding satori six bytes of file path.
 */
export function raw_fonts(extensions: string[]): Plugin {
  return {
    name: 'vite-plugin-raw-fonts',
    resolveId(id) {
      return extensions.some(ext => id.endsWith(ext)) ? id : null
    },
    transform(code, id) {
      if (extensions.some(ext => id.endsWith(ext))) {
        const buffer = readFileSync(id)
        return { code: `export default ${JSON.stringify(buffer)}`, map: null }
      }
    },
  }
}
