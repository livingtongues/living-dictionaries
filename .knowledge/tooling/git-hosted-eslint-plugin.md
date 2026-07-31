# `eslint-plugin-svelte-stylistic` is a git dep on purpose

Root `package.json` pins `"eslint-plugin-svelte-stylistic": "github:jacob-8/eslint-plugin-svelte-stylistic"`
(Jacob's own plugin, also used by tutor/house — so it's never vendored into one repo).

**Why not the npm registry:** npm's latest published version is `0.0.4`; the git HEAD is an
unpublished `0.0.5`. The ONLY diff between the two dists is `context.getSourceCode()` →
`context.sourceCode` — and `getSourceCode()` was removed in ESLint 10, so the published 0.0.4
throws when our config runs. Publishing 0.0.5 would let us drop the git URL; Jacob considers the
npm publish flow more hassle than it's worth (asked and declined 2026-07-31).

## Contributor install failures (all environmental — the repo is public)

`repo:200` / `tarball:200` anonymously; a clean `pnpm add` and even `npm install` of the dep both
succeed from a normal network. So when someone can't install, it's one of:

1. **A git URL rewrite** — `url."git@github.com:".insteadOf "https://github.com/"` in their global
   gitconfig forces the fetch through SSH → `Permission denied (publickey)`. Most common cause.
2. **`codeload.github.com` blocked** — pnpm 10 fetches this dep as a tarball from codeload, a
   *different* host from github.com; proxies/firewalls often allow one and block the other.
3. **Wrong package manager** — pnpm 10 (pinned via `packageManager`) fetches a tarball; `npm` and
   pnpm 9 instead clone and build it, which runs the plugin's `prepare` script (`simple-git-hooks`)
   and can fail. `corepack enable` first.
4. **Node too old** — `site/.npmrc` sets `engine-strict=true`, so an old Node aborts the install
   with an error easy to misattribute to this package.

`Ignored build scripts: eslint-plugin-svelte-stylistic` is a benign warning — the repo commits its
`dist/`, so nothing needs building even though it's in `onlyBuiltDependencies`.

**Unblock:** the plugin is lint-only. Removing its `package.json` line + its import/two rules from
`eslint.config.js` lets dev/build/test run normally (never commit that).
