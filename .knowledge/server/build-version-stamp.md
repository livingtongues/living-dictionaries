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

## Constant WITHIN a build is only half of the contract

Measured 2026-08-05: one commit was built twice in a day, and the two images were
**genuinely different applications wearing one name** — the image build bakes in answers fetched
from the still-running site (`fetch-baked-i18n.mjs`, `fetch-homepage-baked.mjs`), so every
content-addressed file name changed while `kit.version.name` did not. Three instruments went blind
at once, and none of them looked broken:

| what broke | why |
|---|---|
| the 60-second update poll never fired | no tab anywhere saw a changed string in `version.json` |
| the "current vs stale build" error split miscounted | thirteen stale-bundle failures were filed against the CURRENT build — the number that is supposed to mean "what we just shipped is broken" |
| the day's deploy vanished from the timeline | markers come from the first day each *distinct* name is seen |

Since 2026-08-06 the name is `<GIT_SHA>-<BUILD_ID>` whenever a build id is supplied. Two details
you cannot read off the code:

- **The id is minted in the Dockerfile, in the same shell as `pnpm build`** — deliberately not in
  the config and not on the VPS. Not in the config because a clock read there is evaluated once per
  config load (four loads, three realms — see the table above) and that IS the outage. Not on the
  VPS because `deploy.sh` lives outside this repository, so a repo-only change ships through the
  normal webhook. `ARG BUILD_ID` is there so `deploy.sh` can supply its own later without touching
  the Dockerfile.
- **Docker layer caching gives the right semantics for free.** The `date` only runs when the build
  layer is not cached — and a cached layer means a byte-identical build, which *should* keep its
  name. A cache miss means the output may differ, and it gets a new one.

## Consequence: `app_version` is no longer a timestamp

Telemetry rows carry the commit sha as `app_version` now. Anything that decoded that string as an
epoch is dead code:

- `log-analytics.ts` `build_epoch_ms` returns `null` for a sha, which would have dumped every
  non-current build into the "unknown age" bucket and silently emptied the build-adoption panel. It
  now falls back to `deploys[].first_seen` (the first moment any browser reported that build), which
  is both more accurate for adoption *and* scheme-independent. The `unknown` bucket is now
  effectively always 0.
- `short_version` special-cases a commit to the leading 7 (git's own shortening) rather than the
  trailing 8, **and knows the compound `<sha>-<build id>` shape**. The compound half is the one that
  is easy to get wrong: the earlier version tested for exactly 40 hex and fell through to a trailing
  slice for anything else, so it would have shown a piece of the BUILD ID and let it read as the
  commit. Not a crash — a label that quietly stops meaning what it says. Both the shape reader
  (`commit_sha_of_build`) and the formatter live in `$lib/analytics/dashboard-format`, on purpose:
  the whole defect class here was three readers each carrying a private assumption about the shape.
- A rebuild of the same commit *used to* fail to nudge long-lived tabs to reload. It was written
  off as theoretical ("every real deploy is a new commit") and it happened the next day — see the
  section above. `BUILD_ID` closes it; `stale-bundle-recovery.ts` remains the backstop.

## The post-build check is the actual guarantee

`pnpm build` = `vite build && node scripts/check-build-version.mjs`. It requires ONE stamp across
three independent artifacts and that it equals `djb2(version.json)`. Two non-obvious details:

- **Only the client tree may be scanned for `__sveltekit_<hash>`.** `build/server/index.js` contains
  the SSR runtime's own source — the template `` `__sveltekit_${options.version_hash}` `` and a
  literal `globalThis.__sveltekit_sw` (the service-worker env endpoint). Both are false positives;
  the server side is read via `version_hash: "…"` instead. The first version of the check failed a
  perfectly good build on `__sveltekit_sw`. Scanning only the client tree is **not** enough on its
  own, which is why the fixed names are also excluded by name since 2026-08-06: kit injects
  `globalThis.__sveltekit_sw.env` into the CLIENT service worker the moment the app imports
  `$service-worker`'s `env`, and a scan without the exclusion list rejects that healthy build
  (reproduced against a synthetic tree — it is scenario 7 of `scripts/check-build-version.test.mjs`).
- **The guard reads the `.br`/`.gz` copies too.** Those are the bytes adapter-node serves to any
  browser sending `Accept-Encoding`, so a mismatch confined to a compressed copy is invisible in the
  plain file and reaches every real person.
- **It rejects a bare clock version NAME even when every artifact agrees**, because such a build
  passed by luck rather than by construction.
- Checking `version.json` too is what makes the three artifacts *provably derived* from one name
  rather than merely equal.
