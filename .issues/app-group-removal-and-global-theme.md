# Remove Kitbook `(app)` remnant + promote theme app-wide (LD & house)

Status: **planning / interview** (2026-06-05). Cross-project (LD + house). One-writer-per-tree applies.

## What the user asked
1. Remove the Kitbook-remnant `(app)` route group (thought to be in both house & LD).
2. Decide layout architecture: one shared layout for everything vs. admin gets a "reset"/isolated layout.
3. Promote the theme files (currently admin-scoped) to **app-wide**, matching the example/learn-from repos, **without breaking UnoCSS's own reset**. Wants a *gradual* path.

## Investigation findings (verified in code)

### `(app)` route group
- **LD does NOT have `(app)`.** `site/src/routes` is already flat (`about/ account/ admin/ api/ [dictionaryId]/ …`). Matches the example's flat layout. Nothing to remove in LD.
- **house DOES have `(app)`** — `site/src/routes/(app)/` wraps `account, dr-house, privacy-policy, search, [version]` + holds the only `+layout.svelte`, `+layout.server.ts`, `global.css`, `Analytics.svelte`, `+error.svelte`, `+page.svelte`. `admin/`, `viewer-dev/`, `api/` sit OUTSIDE the group.
- house has **no root `+layout.svelte`** at all → admin & viewer-dev run under SvelteKit's default passthrough (no uno reset / global). Collapsing `(app)`→root would newly subject admin/viewer-dev to the root layout's uno reset + global.css — handle with care.
- LD's many `_*.stories.ts` / `kitbook.config.ts` are **svelte-look** (active tool), NOT removable. Keep.

### Theme files — current state
- LD & house each have `site/src/lib/admin/admin-theme.css`: the example's `theme.css` + `buttons.css`, **scoped to `.admin-root`** (LD) / `.admin-theme` (house). Decision comment dated 2026-06-05 says scoping was deliberate "so the UnoCSS main site is untouched."
- **Example repo went plain-CSS** (NOT uno): its `reset.css` is a *verbatim copy* of `@unocss/reset/tailwind.css`, no `uno.config.ts`, no `virtual:uno.css`. Root `+layout.svelte` imports `$lib/reset.css` + `$lib/theme.css` + `$lib/buttons.css` globally.
- **LD/house KEEP uno** (orchestration mandate). LD root layout imports `./reset.css` (`@import '@unocss/reset/tailwind.css' layer(reset)`) + `virtual:uno.css` + `./global.css`. So: take example's **theme.css + buttons.css** but **NOT** its reset.css — LD's uno-plugin reset stays.

### The forcing function (why global is wanted)
Shared vendored components used on the **main** site already reference the semantic vars + `.btn-*` classes that are currently only defined under `.admin-root`:
- vars `--primary/--surface/--background/--color-secondary/--border-color`: `svelte-pieces/{Modal,Slideover,CopyButton,RichTextEditor,Toasts}.svelte`, `components/entry/BadgeArray.svelte`, `layout/UserMenu.svelte`, `db/sync/SyncStatus.svelte`.
- `.btn / .btn-sm / .btn-ghost`: BadgeArray, Modal, Slideover, SyncStatus, UserMenu.
Outside `/admin` these vars/classes are **undefined** → those components are unstyled on the main site. Promoting the theme globally fixes this.

### Reset reconciliation (the "don't break uno" answer)
theme.css/buttons.css contain **no reset** — only CSS variables, `body` paint, font-family, and `.btn-*` classes. They don't touch uno's reset. Promote them as **unlayered** global CSS imported AFTER `virtual:uno.css`; the uno reset stays in `layer(reset)` (lowest priority). No conflict.

### The real hazard: dark mode
Example `theme.css` includes `@media (prefers-color-scheme: dark) :root:not(.light)` flipping the WHOLE document to near-black bg / white text. LD's **legacy main pages are not dark-ready** → dark-OS users would get a half-broken dark site. Mitigate by forcing light site-wide for now (keep explicit `.dark` working for admin / svelte-look previews); re-enable system-dark per-section later.

## Proposed gradual plan (LD) — pending interview
1. Add `site/src/lib/theme.css` (semantic vars + body paint + font; light default; **drop/guard** the system-dark media query for now) and `site/src/lib/buttons.css` (global `.btn-*`), ported from example minus `.admin-root` scoping.
2. Import both in root `+layout.svelte`, order: `reset.css` → `virtual:uno.css` → `theme.css` → `buttons.css` → `global.css`.
3. Reduce `admin/+layout.svelte`'s `admin-theme.css` to admin-chrome-only (or delete; remove `.admin-root` scoping). Admin can opt into dark by putting `.dark` on its root wrapper.
4. Verify: main-site toasts/modals/buttons now themed; legacy pages unchanged in light; admin unchanged; `pnpm --filter=site check` + build green; svelte-look dark previews still work.

house mirrors this AND collapses `(app)`→root as a separate house session (one-writer rule).

## Decisions (locked via interview 2026-06-05)
- Q15 **B**: do both repos this session, LD first then house.
- Q16 **A**: one shared root layout owns the global theme; admin = nested chrome-only layout.
- Q17 **A**: promote theme.css + buttons.css to global; drop `.admin-root` scoping.
- Q18 **A**: force light site-wide for now — keep explicit `.dark`/`.light` selectors ACTIVE, COMMENT OUT the system `prefers-color-scheme` block (don't delete). Admin/svelte-look opt into dark explicitly.
- Extra (Jacob): archive the example's plain `reset.css` in each repo (for the eventual uno→vanilla swap). Comment out dark logic rather than deleting it — keep every piece in place so dropping UnoCSS later is easy. **We keep UnoCSS for now** (too big a visual shift to change now); vanilla CSS is the long-term direction.

## LD — DONE ✅ (verified: `check` 0 errors, svelte-look admin layout + reply-composer render themed from global CSS)
- ✅ `site/src/lib/theme.css` — global semantic vars + body paint + font; light forced; system-dark block commented (preserved); `.dark`/`.light` active.
- ✅ `site/src/lib/buttons.css` — global `.btn-*` (ported from example).
- ✅ root `+layout.svelte` imports: reset.css → virtual:uno.css → $lib/theme.css → $lib/buttons.css → global.css.
- ✅ `admin/+layout.svelte` — removed `admin-theme.css` import + dead `.admin-root` classes.
- ✅ deleted `site/src/lib/admin/admin-theme.css` (only consumer was admin layout; `lib/admin/` kept — has other components).
- ✅ `svelte-look.config.ts` css_files now `['src/lib/theme.css','src/lib/buttons.css','src/routes/global.css']` (so isolated component previews get the theme; `dark_mode:false` matches light-forced).
- ✅ archived `archive/css/reset.css` (verbatim uno reset copy from example) + header note on how/why to swap when uno is dropped.
- LD had NO `(app)` group → nothing to collapse here.
- **Jacob eyeball (live :3041):** main-site buttons/modals/toasts now themed; legacy pages unchanged in light; admin chrome intact.

## house — investigated; plan CHANGED (needs Jacob go-ahead before mutating live routing)

house is in a **different migration state** than LD — the symmetric assumption was wrong:

**Theme promotion is PREMATURE in house (recommend defer):**
- **0** customer components (outside `/admin`) reference the theme vars — vs LD where shared svelte-pieces forced the issue. House's customer app still uses **UnoCSS purple + Font Awesome + grays** (per its own `admin-theme.css` header comment).
- house theme is **purple** (`--light-primary: hsl(271…)`), imports the **Inter webfont** (`@fontsource-variable/inter`). Promoting globally would visibly change the LIVE customer app's font + palette + body paint — a big visual shift, the opposite of what we want.
- house `admin-theme.css` is intentionally scoped to `.admin-theme` and its comment documents the lift-to-`:root` as a *deliberate future* step gated on the customer-app migration.

**`(app)` collapse in house — doable but medium-risk on a LIVE app:**
- Moving `(app)/*`→`routes/` makes `(app)/+layout.*` the ROOT; admin/viewer-dev (which today have NO root layout) start inheriting: uno reset, `(app)/global.css` (benign — select arrow + scrollbars), Toasts, Analytics, AuthSubscribeGuard, and the ungated user-resolve `+layout.server.ts`/`+layout.ts`.
- Composition is safe: admin's gated `+layout.server.ts` (redirect/403) + `+layout.ts` (wa-sqlite/sync) still run nested and override; `data.user`/`data.sync` intact. AuthSubscribeGuard's paywall `beforeNavigate` only fires on img/doc/vid paths → inert on admin. Analytics on admin = negligible.
- **Must fix:** admin renders its own `<Toasts/>` → root also renders one → **double Toasts**. Remove from admin layout.
- **Reset reassurance:** house svelte-look injects `@unocss/reset/tailwind.css`, so admin components are already authored/previewed WITH the reset; the live admin (no reset today) is the anomaly — collapse makes live admin MATCH its svelte-look previews.
- house is on **`main`** (its deploy branch) → any house edit must be on a **feature branch first**; needs Jacob's `:5000` eyeball before deploy.

## house — DONE ✅ (committed `9464c3d` on `main`, not pushed)
Executed the runbook below directly on `main` (Jacob: "no need to create a branch"). First committed the 103-file WIP as `3ff72c2` to clean the tree.
- ✅ Collapsed `(app)`→root (git detected renames, history preserved); admin/viewer-dev now inherit the root layout.
- ✅ Deduped the double `<Toasts/>` (removed from admin layout).
- ✅ `$lib/theme.css` (vars on `:root`, **inert** for customers) + `$lib/buttons.css`; paint/Inter/`.btn-*` fenced to `.admin-theme` → **visual parity**. Deleted `admin-theme.css`. Light-forced (system-dark commented).
- ✅ svelte-look css_files updated; archived `archive/css/reset.css`; stale `(app)/` doc-comment paths fixed across 6 files.
- ✅ **Build gotcha fixed:** `privacy-policy/+page.svelte` imported `../../../docs/privacy-policy.md?raw`; the move shifted it up a level → changed to `../../docs/…`. (svelte-check passed but `vite build` failed — `?raw` imports aren't path-resolved by check; ALWAYS run `build` after a route-group collapse, not just check.)
- ✅ Verified: `check` 0 errors, `build` passes, parity grep clean, svelte-look (house CLI) admin = purple+Inter / customer = system-font untouched. Future plan written to house `.issues/theme-app-wide-and-drop-uno.md`.
- ⏳ **Jacob `:5000` eyeball:** customer pages unchanged; admin intact; admin now inherits the uno reset.

> NOTE: the `mcp__svelte-look__SvelteLook` MCP tool is pinned to **living-dictionaries** — it screenshots LD components even when given a house path. For house, use the house CLI: `house/site/node_modules/.bin/svelte-look <path> --output <file>` then Read the PNG.

## house RUNBOOK (executed — kept for reference)

Decision (Jacob): do BOTH the `(app)` collapse AND promote the theme app-wide **with visual parity** (no customer color/font change), + write future "theme everywhere" notes.

**BLOCKER (2026-06-05):** house `main` has **103 uncommitted files** — a large in-progress refactor (auth→`user.svelte.ts`, `lib/stores/*` deleted, dozens of components modified, the entire `(app)/[version]` subtree edited, Dockerfile/package.json/pnpm-lock, `.issues` reshuffled, new `lib/agent/`, email-inbound). The `(app)` collapse `git mv`s files that are themselves modified → would entangle with that WIP (the documented house burn). **Do NOT execute until house's tree is committed/clean.** I created+deleted a throwaway branch and confirmed `git mv` aborts atomically; house is restored to `main`, nothing moved. 0 running sessions; 1 idle "svelte 4→5 audit" session.

### Parity design (verified facts)
- **0** customer-rendered components read the semantic vars. The ONLY non-admin reader is `SyncStatus.svelte` (`var(--danger)`), and SyncStatus is rendered **only** in `admin/+layout.svelte` → always inside `.admin-theme`. ⇒ lifting var *definitions* to `:root` is 100% inert for customers.
- house has **NO `.btn` uno shortcut** (only `form-input`); customer `.btn`/`.btn-ghost` (Toasts `.toast-btn` is separate; SyncStatus, Medium, intro/img-edit pages) are currently unstyled outside admin → keep `.btn-*` gated to `.admin-theme` so they stay unchanged.
- Inter (`@fontsource-variable/inter`) is loaded ONLY by admin-theme.css; customer uses the uno-reset system stack → keep `font-family` gated.
- `Toasts` renders in BOTH `(app)/+layout.svelte` and `admin/+layout.svelte` → **double Toasts** after collapse; remove from admin.
- house `(app)/global.css` = benign (select arrow + scrollbars); fine to apply app-wide.
- Composition safe: admin's gated `+layout.server.ts` (redirect/403) + `+layout.ts` (wa-sqlite/sync) still run nested & override; `data.user`/`data.sync` intact. AuthSubscribeGuard's paywall `beforeNavigate` only fires on img/doc/vid paths → inert on admin.
- house svelte-look already injects `@unocss/reset/tailwind.css` → admin authored WITH the reset; collapse makes live admin (no reset today) MATCH its previews.

### RUNBOOK (execute on a CLEAN tree, branch `feature/remove-app-group-global-theme`)
1. **Collapse `(app)`→root:** move all 12 items (`+layout.svelte/.ts/.server.ts`, `+page.svelte`, `+error.svelte`, `global.css`, `Analytics.svelte`, dirs `account dr-house privacy-policy search [version]`) up to `site/src/routes/`. NOTE several are untracked/modified → use plain `mv` (not `git mv`) and let `git add -A` detect renames. `rmdir (app)`. `svelte-kit sync` regenerates `$types`.
2. **Dedupe:** remove `<Toasts/>` + its import from `admin/+layout.svelte` (root provides it).
3. **Split theme into `$lib/theme.css`** (port from `admin-theme.css`, purple + Inter):
   - `@import '@fontsource-variable/inter'`.
   - `:root { --light-* ; --dark-* ; --transition-time ; --font-sans:'Inter Variable',sans-serif ; --font-mono }`.
   - `:root, .light { --primary..--success semantic mapping }` (NO paint here — global, inert).
   - `.dark { semantic dark mapping ; color-scheme:dark }` (active); COMMENT OUT the `@media (prefers-color-scheme: dark) .admin-theme:not(.light)` block (preserve, light-forced).
   - `.admin-theme { color-scheme:light; background-color:var(--background); color:var(--color); font-family:var(--font-sans) }`  ← PAINT+FONT gated = parity.
   - `.admin-theme.dark { color-scheme:dark }`; reduced-motion on `.admin-theme`.
4. **`$lib/buttons.css`:** the `.admin-theme .btn-*` rules + `.admin-theme .animate-spin/.animate-pulse` (verbatim from admin-theme.css, keep `.admin-theme` scoping).
5. **Wire:** import `$lib/theme.css` + `$lib/buttons.css` in the NEW root `+layout.svelte` (after `virtual:uno.css`). Remove `import '$lib/admin/admin-theme.css'` from admin layout. **Delete** `site/src/lib/admin/admin-theme.css`. Keep `.admin-theme` class on the admin wrapper div (now the fence for paint/font/buttons).
6. **svelte-look.config.ts:** `css_files` `'src/routes/(app)/global.css'` → `['src/lib/theme.css','src/lib/buttons.css','src/routes/global.css']`.
7. **Archive:** `mkdir -p archive/css` + copy `learn-from/src/lib/reset.css` (or example's) → `archive/css/reset.css` with the same swap-when-uno-dropped header note as LD.
8. **Verify:** `pnpm --filter=site check` (match baseline), build, svelte-look admin shots; then Jacob `:5000` eyeball — customer pages byte-identical; admin intact (watch: admin now inherits the uno reset). Commit on branch, do NOT push (house `main` is the deploy branch).

## FUTURE — "apply the theme to everything" (both repos, the real endgame)
This task promoted the **variable layer** app-wide. Two further moves, each its own reversible step:

**A) Drop the `.admin-theme`/admin fence so the WHOLE app adopts the theme:**
- LD: already global (no fence) — DONE. LD's remaining endgame is just dropping UnoCSS (below).
- house: when the customer app is ready, change `$lib/theme.css` so the PAINT+FONT apply on `:root, .light` / `.dark` (as LD/example do) instead of `.admin-theme`, and un-scope `$lib/buttons.css` (`.btn-*` global). Before flipping: migrate customer components off **uno purple utilities + Font Awesome + system font** to `var(--primary)` etc. + the `.btn-*` classes, page-by-page, eyeballing each. The customer app currently has 0 `var(--…)` readers, so this is real migration work, not a flip.
- Re-enable system dark per-section: uncomment the `@media (prefers-color-scheme: dark)` block (scope to dark-ready sections first) once pages are audited for dark.

**B) Drop UnoCSS → vanilla CSS (long-term, both repos; KEEP uno for now — too big a visual shift):**
- The pieces are staged: `theme.css` + `buttons.css` are already plain CSS; the plain reset is archived at `archive/css/reset.css`.
- When ready: remove the `unocss/vite` plugin + `virtual:uno.css` import + `@unocss/reset` import; swap in `archive/css/reset.css` (verbatim uno reset, so element defaults stay identical); replace remaining uno utility classes in markup with plain CSS / the theme classes. Do it incrementally; the reset swap keeps the baseline identical so only utility-class usage needs porting.
- The example repo (`living-dictionaries-example`) is the finished plain-CSS destination — peek there for the end shape.

**UNBLOCKED 2026-06-05:** house's 103-file WIP was committed as `3ff72c2` ("Migrate auth to AuthUser runes singleton; add email-inbound support"); house `main` tree is now CLEAN (not pushed). While committing, the pre-commit hook (test+check+lint) surfaced 3 issues I fixed: (1) pre-existing Stripe `$env/static/private` check errors → moved `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to `$env/dynamic/private` (house's runtime-secret convention; secret absent in dev no longer breaks check/build); (2) updated `webhook/server.test.ts` to mock `$env/dynamic/private`; (3) `/* noop */` on 3 empty mock methods in `svelte-look-mocks.ts`. → The house RUNBOOK above can now run on a fresh branch off `main`.
