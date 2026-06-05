// @ts-check
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import adapter from '@sveltejs/adapter-node'

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
    // Honoured by both `svelte-check` and the build (unlike `onwarn`, which svelte-check ignores).
    // Silences pre-existing legacy a11y + harmless deprecation noise so real warnings stay visible.
    // Intentionally NOT silenced: state_referenced_locally (init-value captures worth eyeballing) and
    // node_invalid_placement_ssr (real SSR/hydration nesting).
    warningFilter: (warning) => {
      const silenced = [
        'element_invalid_self_closing_tag',
        'attribute_quoted',
      ]
      if (warning.code.startsWith('a11y') || warning.code.startsWith('constant_assignment'))
        return false
      if (silenced.includes(warning.code))
        return false
      return true
    },
  },
}

export default config
