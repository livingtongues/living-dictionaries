# The build version stamp — measured facts about `kit.version.name`

*Established 2026-08-04, from the poly.education blank-page outage (tutor,
`.issues/poly-education-version-hash-outage.md`) and a set of experiments run against LD's own
build. The CODE is `site/svelte.config.js` + `site/scripts/check-build-version.mjs`; this page is
only the things you cannot learn by reading them.*

## The failure this prevents

SvelteKit djb2-hashes `kit.version.name` into `globalThis.__sveltekit_<hash>`. The SSR'd page shell
*defines* that global; the client bundle *reads* it. If two config loads inside one build yield
different names, the client reads `undefined.env`, throws before first paint, and **every route
serves a blank page with HTTP 200**. Every server-side signal stays green — uptime probes, health
checks, error rates. poly.education was down nine hours that way.

`kit.version.name`'s framework default is literally `Date.now().toString()`
(`@sveltejs/kit@2.63.0`, `src/core/config/options.js:321`), so *not setting it* is opting into the
bug and hoping the timing is kind.

## Measured: LD's build loads `svelte.config.js` FOUR times, in THREE realms

Instrumented directly (probe in `resolve_version_name`, `vite build` with git removed from PATH):

| # | Loaded by | `process.pid` | Fresh `globalThis`? |
|---|---|---|---|
| 1 | `vite/bin/vite.js build` | 1554234 | — |
| 2 | `@sveltejs/kit/src/core/postbuild/analyse.js` | **1554234** | **yes** |
| 3 | `vite/bin/vite.js build` (second pass) | 1554234 | yes |
| 4 | `@sveltejs/kit/src/core/postbuild/prerender.js` | **1554234** | **yes** |

**All four report the same pid, and three of them still mint a different memo.** SvelteKit runs its
postbuild passes in **worker threads**, which share the process id but not the global object. So:

- "LD's build is one process, therefore a `globalThis` memo is enough" is **false** — that was the
  assumption going in, and the probe killed it.
- `process.env` *does* survive (it's inherited by worker threads), which is why `GIT_SHA` and
  `NODE_ENV` are usable discriminators and a memo is not.

## Why `NODE_ENV` is the "is this a real build?" signal

`vite build` sets `NODE_ENV=production` **for itself, before loading the config** — observed in all
four loads above, with no `NODE_ENV` set by the caller. svelte-look (which renders stories through
vite SSR) loads the same config with `NODE_ENV=development`. That difference is what lets the config
**throw** for a build while still letting dev tooling load it.

This matters because svelte-look loads the config with a **sanitized PATH that has no git** — an
unconditional throw made every component screenshot in the repo fail.

## Why the empty-string fallback is a trap

`vps-setup/bin/sync` generates the compose file with `args: GIT_SHA: ${GIT_SHA:-}`. Shell `${VAR:-}`
on an unset variable expands to the **empty string**, not to nothing — and `''` is falsy in JS. So
`process.env.GIT_SHA || Date.now().toString()` silently lands on the clock on a real deploy, with a
green build log. The sha must be **trimmed and required non-empty**.

Verified for LD specifically: `/opt/hosting/sveltekit/deploy.sh` on the living VPS (the script the
GitHub webhook runs) exports `GIT_SHA` from the cloned repo's git before `docker compose build`, and
`/opt/hosting/sveltekit/docker-compose.yml` passes it as a build arg. No vps-setup change was needed.

## Consequence: `app_version` is no longer a timestamp

Telemetry rows carry the commit sha as `app_version` now. Anything that decoded that string as an
epoch is dead code:

- `log-analytics.ts` `build_epoch_ms` returns `null` for a sha, which would have dumped every
  non-current build into the "unknown age" bucket and silently emptied the build-adoption panel. It
  now falls back to `deploys[].first_seen` (the first moment any browser reported that build), which
  is both more accurate for adoption *and* scheme-independent. The `unknown` bucket is now
  effectively always 0.
- `short_version` special-cases a 40-hex sha to the leading 7 (git's own shortening) rather than the
  trailing 8.
- A rebuild of the *same commit* no longer nudges long-lived tabs to reload (they poll
  `version.json` for a changed string). Every real deploy is a new commit, so this is theoretical;
  `stale-bundle-recovery.ts` remains the backstop.

## The post-build check is the actual guarantee

`pnpm build` = `vite build && node scripts/check-build-version.mjs`. It requires ONE stamp across
three independent artifacts and that it equals `djb2(version.json)`. Two non-obvious details:

- **Only the client tree may be scanned for `__sveltekit_<hash>`.** `build/server/index.js` contains
  the SSR runtime's own source — the template `` `__sveltekit_${options.version_hash}` `` and a
  literal `globalThis.__sveltekit_sw` (the service-worker env endpoint). Both are false positives;
  the server side is read via `version_hash: "…"` instead. The first version of the check failed a
  perfectly good build on `__sveltekit_sw`.
- Checking `version.json` too is what makes the three artifacts *provably derived* from one name
  rather than merely equal.
