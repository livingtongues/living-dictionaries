// @ts-check
import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
    // Mirror of tutor's filter: kill noisy global warnings that aren't useful
    // for us. We do NOT filter `state_referenced_locally` here — it catches
    // real bugs; suppress per-line with `// svelte-ignore state_referenced_locally`
    // when the form-init capture pattern is intentional.
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
}

export default config
