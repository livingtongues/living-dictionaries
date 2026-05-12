// @ts-check
import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from '@unocss/svelte-scoped/preprocess'

// @unocss/svelte-scoped's vite plugin tries to auto-inject this preprocessor via
// `api.sveltePreprocess` — an API removed in @sveltejs/vite-plugin-svelte 7+. So we
// must register it explicitly here, otherwise utility classes in .svelte files never
// get transformed and no styles apply. (The plugin still does the runtime work of
// generating the global stylesheet via the %unocss-svelte-scoped.global% placeholder
// in app.html.)

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    UnoCSS(),
    vitePreprocess(),
  ],
  kit: {
    adapter: adapter(),
  },
}

export default config
