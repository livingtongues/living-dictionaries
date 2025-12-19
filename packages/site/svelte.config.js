// @ts-check
import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.composition'],
  preprocess: [
    vitePreprocess(),
  ],

  kit: {
    adapter: adapter(),
    alias: {
      $api: 'src/routes/api',
    },
  },

  compilerOptions: {
    // disable all warnings coming from node_modules and all accessibility warnings
    warningFilter: (warning) => {
      if (warning.filename?.includes('node_modules'))
        return false
      if (warning.code.startsWith('a11y') || warning.code.startsWith('constant_assignment'))
        return false
      if (warning.message.includes('Self-closing HTML tags'))
        return false
      return true
    },
  },

  vitePlugin: {
    inspector: {
      holdMode: true,
    },
  },
}

export default config
