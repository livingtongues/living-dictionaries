// @ts-check
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import adapter from '@sveltejs/adapter-node'

/**
 * `kit.version.name` must be IDENTICAL for every load of this config within one
 * build. SvelteKit djb2-hashes it into the `globalThis.__sveltekit_<hash>` name
 * that the server-rendered page shell DEFINES and the client bundle READS
 * (@sveltejs/kit 2.63.0, `src/exports/vite/index.js:241`). Leaving it unset
 * takes the framework default, which is literally `Date.now().toString()`
 * (`src/core/config/options.js:321`) — so two config loads inside one build
 * produce two different globals, the client bundle reads `undefined.env`, and
 * every route serves a BLANK PAGE with HTTP 200. That is what took
 * poly.education down for nine hours on 2026-08-03 (tutor
 * `.issues/poly-education-version-hash-outage.md`); LD was safe only by the
 * accident of its container running `vite build` exactly once.
 *
 * A commit sha is constant across every config load within a build BY
 * CONSTRUCTION, so the shell and the bundle cannot disagree.
 *
 * The naive `process.env.GIT_SHA || Date.now().toString()` is a TRAP: compose
 * passes `GIT_SHA: ${GIT_SHA:-}`, so an unset variable arrives as the EMPTY
 * STRING — falsy — and the chain silently falls back into the exact expression
 * that caused the outage, on a green build log. So the sha must be NON-EMPTY to
 * be accepted, and a production build that cannot name itself deterministically
 * must STOP rather than ship:
 *
 *   1. `GIT_SHA`, trimmed and required non-empty — the deploy path
 *      (`/opt/hosting/sveltekit/deploy.sh` exports it before `docker compose
 *      build`; the Dockerfile's builder stage takes it as an ARG).
 *   2. `git rev-parse HEAD` — every host build: local `pnpm build`, mustang.
 *   3. `NODE_ENV === 'production'` (which `vite build` sets for itself, before
 *      loading this file) → THROW.
 *   4. otherwise a `local-<timestamp>`, memoized per realm. This rung exists
 *      ONLY so config-loading dev TOOLS keep working — svelte-look renders
 *      stories with a sanitized PATH that has no git — and it can never be
 *      reached by a build, because of rung 3.
 *
 * A globalThis memo is NOT a substitute for rung 3, and this was MEASURED, not
 * assumed: `vite build` loads this config FOUR times, and while all four report
 * the same `process.pid`, three of them mint a different memo — SvelteKit runs
 * its `postbuild/analyse.js` and `postbuild/prerender.js` passes in worker
 * threads, which share the pid but NOT `globalThis`. A clock here would have
 * produced four different names inside one build.
 *
 * The belt to this brace: `pnpm build` runs `scripts/check-build-version.mjs`
 * afterwards, which fails the build unless the client chunks, the server bundle
 * and `version.json` all carry ONE stamp. Whatever names a build, it cannot ship
 * mismatched.
 */
function resolve_version_name() {
  const git_sha = (process.env.GIT_SHA || '').trim()
  if (git_sha)
    return git_sha

  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (head)
      return head
  } catch {
    // no git binary / no .git dir / a tool with a sanitized PATH — fall through
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to build: no stable build version available.\n'
      + 'kit.version.name must be constant across config loads, and neither a non-empty\n'
      + 'GIT_SHA nor `git rev-parse HEAD` is available here. A clock-derived name would\n'
      + 'give the page shell and the client bundle different __sveltekit_<hash> globals\n'
      + 'and serve a blank page on every route (poly.education, 2026-08-03, nine hours).\n'
      + 'Fix: pass the commit in — `docker build --build-arg GIT_SHA=$(git rev-parse HEAD)`,\n'
      + 'or export GIT_SHA before `docker compose build` (the VPS deploy.sh already does).',
    )
  }

  const memo = /** @type {{ __ld_version_name?: string }} */ (globalThis)
  if (!memo.__ld_version_name) {
    memo.__ld_version_name = `local-${Date.now()}`
    console.warn(`[svelte.config] No GIT_SHA and no git — naming this dev session "${memo.__ld_version_name}".`)
  }
  return memo.__ld_version_name
}

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
    version: {
      // The commit being built — see `resolve_version_name()` above. NEVER a clock.
      name: resolve_version_name(),
      // Poll `_app/version.json` every 60s so long-lived open tabs detect a new
      // deploy and the root +layout shows a non-blocking "reload" toast. The
      // service worker handles asset freshness; this closes the idle-pinned-tab
      // gap (a tab the user never navigates would otherwise keep running old code,
      // since the SW only update-checks on navigation).
      pollInterval: 60_000,
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
