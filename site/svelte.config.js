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
    // Absolute asset/script URLs. SvelteKit's default (`relative: true`) bakes a
    // path-depth-relative URL into the SSR'd page — on an entry page that's
    // `../../service-worker.js` — but registration runs on the window `load`
    // event, so a visitor who navigates before that fires resolves it against
    // the URL they navigated TO, gets a 404, and spends the whole session with
    // no service worker (no offline support, no cached app code) and nothing in
    // telemetry to say so. We never serve under a base path, so relative URLs
    // buy us nothing. Ported from house `ce08077c`.
    paths: { relative: false },
    // Disable SvelteKit's built-in cross-origin form CSRF guard so we can
    // re-implement it in hooks.server.ts with a carve-out for token-authenticated
    // `/api/v1/*` uploads (see src/lib/server/csrf.ts). The built-in runs before
    // the handle hook and 403s every form POST lacking a matching Origin header —
    // which server-side API clients (curl/Python) never send. `trustedOrigins:
    // ['*']` is the non-deprecated way to turn it off; our hook re-adds protection
    // for every cookie-authed form post.
    csrf: { trustedOrigins: ['*'] },
    // Poll `_app/version.json` every 60s so long-lived open tabs detect a new
    // deploy and the root +layout shows a non-blocking "reload" toast. The
    // service worker handles asset freshness; this closes the idle-pinned-tab
    // gap (a tab the user never navigates would otherwise keep running old code,
    // since the SW only update-checks on navigation).
    version: { pollInterval: 60_000 },
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
