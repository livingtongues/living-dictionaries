# M2b (expanded) — Svelte 5 + latest Vite/UnoCSS, vendor svelte-pieces, kitbook→svelte-look, mock-user interactions

Supersedes the original "minimal compat" M2b. Per Jacob: pull kitbook, bring in svelte-look,
upgrade to **latest** Vite + Svelte, **vendor svelte-pieces components into the repo** (port to
Svelte 5; reference example + house + svelte-pieces source; **keep UnoCSS**, don't go plain-CSS),
then navigate the app and fix breakage, with a **logged-in mock user owning one dictionary** so
interactions (edit/add/delete) can be tested.

## Reference = `~/code/house/site` (target stack, still UnoCSS)
- `svelte ^5.56`, `@sveltejs/kit ^2.62`, `@sveltejs/vite-plugin-svelte ^7.1.2`, `svelte-check ^4.5`,
  `vite ^8.0.16`, `vitest ^4.1.8`, `@vitest/ui ^4.1.8`, `typescript ^5.9.3`.
- `unocss ^66.7.0` + `@unocss/preset-icons` + `@unocss/reset` + `@unocss/extractor-svelte`
  (official `class:` extractor → replaces my custom one) + `@unocss/transformer-directives`,
  `@julr/unocss-preset-forms ^2.0.0`. `svelte-look: link:../../svelte-look` replaces kitbook.
- house `uno.config.ts`: `extractors: [extractorSvelte()]`, `transformers: [transformerDirectives()]`.
- house `vite.config.ts` plugins order: `svelte_look()`, `UnoCSS()`, `sveltekit()`.
- house reset: `import '@unocss/reset/tailwind.css'` + `import 'virtual:uno.css'` in root layout.
- **house has already vendored svelte-pieces** at `src/lib/svelte-pieces/{ui,functions,data,actions,stores}/`
  (Svelte 5 + UnoCSS) — copy these; port the rest LD needs from svelte-pieces node_modules / example.

## svelte-pieces exports LD uses (counts)
Button(64) · ShowHide(35) · Modal(19) · Form(7) · ResponsiveTable(4) · loadScriptOnce(4) · JSON(4) ·
BadgeArrayEmit(4) · typeQueryParamStore(3) · ResponsiveSlideover(3) · loadStylesOnce(2) ·
createPersistedStore(2) · BadgeArray(2) · Slideover(1) · ReactiveSet(1) · Menu(1) · longpress(1) ·
IntersectionObserverShared(1) · createQueryParamStore(1) · clickoutside(1). (All bare `from 'svelte-pieces'`.)
House already has: Button, Modal, ShowHide, Form, JSON, ResponsiveTable, clickoutside, portal, trapFocus,
query-param-store, clean-object. Need to add: BadgeArray, BadgeArrayEmit, ResponsiveSlideover, Slideover,
Menu, loadScriptOnce/loadStylesOnce, createPersistedStore, ReactiveSet, longpress, IntersectionObserverShared.

## Mock user owning a dictionary (for interaction testing)
`[dictionaryId]/+layout.ts`: `is_manager`/`can_edit` derive from `my_dictionaries` store where
`role==='manager'`. `my_dictionaries` (supabase/dictionaries.ts) queries `dictionary_roles` by
`user_id`. Plan: stub `getSession` returns a logged-in mock user (id); stub-client returns a
`dictionary_roles` row {user_id, dictionary_id:'achi', role:'manager'} (+ dictionary + maybe
`dictionary_roles_with_profiles`). Then can_edit=true on /achi → edit UI shows.

## Progress
- ✅ **P1 done.** Deps bumped to house stack (svelte 5.56, vite 8.0.16, plugin 7.1.2, kit 2.62,
  svelte-check 4.5, unocss 66.7 + extractor-svelte + transformer-directives + reset + preset-icons,
  preset-forms 2, vitest 4.1.8, ts 5.9.3). svelte-look linked; kitbook removed (34 `.variants.ts`
  deleted; `sleep`/`DeepPartial` vendored to `$lib/helpers`). uno.config uses `extractorSvelte()` +
  `transformerDirectives()`. vite.config: `svelte_look()` plugin, kitbook bits gone. svelte.config:
  `vitePreprocess({ script: true })` (enums), onwarn `a11y` (svelte5 codes). Svelte-5 fixes: `<tr>`→
  `<tbody>` wraps (IpaKeyboard/EntriesTable/email), `<form>`→`<div>` in map modals, `<thead><tr>`,
  `svelte/motion`→`svelte/store` Readable, Textarea autocomplete off, +layout `dir` cast, email
  http-equiv lowercase.
- ✅ **P2 done.** Vendored svelte-pieces → `src/lib/svelte-pieces/` (barrel `index.ts`; imports
  swapped `'svelte-pieces'`→`'$lib/svelte-pieces'`; dep removed). UI from house's Svelte-5 set
  (Button/Modal/JSON/ResponsiveTable + actions/stores); **ShowHide+Form use svelte-pieces LEGACY
  source** (house's runes `{@render children(params)}` throws `invalid_default_snippet` under LD's
  `let:` consumers); rest (Badge, DetectUrl, BadgeArray, BadgeArrayEmit, Slideover, ResponsiveSlideover,
  Menu, ReactiveSet, IntersectionObserverShared, loadOnce, longpress, persisted-store) copied from
  svelte-pieces source + `;;` cleaned. Button gained `rel` prop; Slideover `focus` guarded;
  clickoutside/longpress/persisted `.d.ts` vendored; Search `on:click`→`onclick`.
  **State: check 0 errors / 484 warns (svelte5 deprecations, M2c) · test 123 pass · build ✔ · boot 200.**

## Phases (each ends build+check+boot green)
- [x] **P1 · Deps + config.** Bump package.json to house versions (svelte5/vite8/plugin7/check4/kit2.62/
  unocss66 + extractor-svelte + transformer-directives + reset + preset-icons, preset-forms2, vitest4,
  @vitest/ui4, ts5.9.3). Add `svelte-look` (link:../../svelte-look). Remove `kitbook` + `@unocss/svelte-scoped`(gone)
  + custom extractor. Update `uno.config.ts` (extractorSvelte+transformerDirectives), `vite.config.ts`
  (svelte_look, drop kitbook bits + ts optimizeDep), `+layout.svelte` reset import (revisit reset.css/@layer).
  Root `pnpm.overrides` @types/node as house. Controlled install; audit lockfile diff scope. Fix to green.
- [ ] **P2 · Vendor svelte-pieces.** Copy house's `src/lib/svelte-pieces/*`; port the rest to Svelte 5
  (keep UnoCSS classes); swap all `from 'svelte-pieces'` → `$lib/svelte-pieces/...`; drop svelte-pieces dep.
- [x] **P3 · kitbook→svelte-look.** ✅ `svelte_look()` in vite.config; `svelte-look.config.ts` added
  (uno css_imports, light-only); SKILL.md copied to `.claude/skills/svelte-look/`. kitbook dep +
  34 `.variants.ts` removed; `kitbook.config.ts` still on disk (harmless, not imported — delete later).
  Stories (`.stories.ts`) not yet authored — add as components get visual coverage.
- [x] **P4 · Mock user manages 'achi'.** ✅ `src/lib/mocks/mock-user.ts` (MOCK_USER_ID + manager of
  `achi`); `getSession` (supabase/index.ts) returns `mock_auth_response`; stub-client `dummy_data`
  gains `dictionary_roles: [{user_id, dictionary_id:'achi', role:'manager'}]`. Verified: header shows
  "M" avatar (signed in), `is_manager`/`can_edit` true → Add Entry / Settings / Import / Export show.
- [x] **P5 · Navigate + interaction test.** ✅ Verified via headless browser on `node build`: home,
  /dictionaries, /about, /achi, /achi/entries, /achi/settings all 200 + render styled (UnoCSS 66 OK).
  **Add Entry interaction works** → opens vendored Modal (grey backdrop via @layer reset) with Form
  input + Cancel/Next Buttons.
- [x] **P5.1 · Seed dummy ENTRIES into the stub (resolves the `0 / 8` finding).** ✅ New
  `src/lib/mocks/dummy-entries.ts` — 13 Achi `entries` + matching `senses` (en+es glosses, POS,
  semantic domains), 2 speakers, 2 audio (+ audio_speakers), 2 tags (+ entry_tags), 2 dialects
  (+ entry_dialects), all typed against generated `Tables<…>`. Wired into `stub-client.ts`
  `dummy_data` (`entries/senses/audio/speakers/tags/dialects` + join tables). Set achi
  `gloss_languages: ['en','es']` in `dummy-dictionaries.ts`. **Stretch done:** stub-client
  `insert/upsert/update/delete` now MUTATE the in-memory `dummy_data` arrays and return affected
  rows so `.select().single()` callers get their row → full edit round-trip works.
  **Browser-verified on `node build` :3094 (manager mock):** entries list shows **1-13 / 13** with
  lexeme/phonetic/POS/glosses/domains/dialects/audio · click entry → overlay Modal (grey backdrop) ·
  click Phonetic field → EditFieldModal w/ IPA keyboard (tbody-nesting fix holds) · **edited phonetic
  → `[haʔ-EDITED]` reflected in UI** · **Add Sense → Sense 2 appears** · **delete Sense 2 (✕) → back
  to 1 sense, Sense 1 intact** · Filters slideover (typo-tolerance slider + POS facets noun 10 /
  adjective 3 + semantic-domain facets) · List/Table/Gallery toggles all render (gallery empty — no
  dummy photos, expected) · /achi/settings shows EN+ES gloss langs · /achi/{about,contributors,
  export,import,history,grammar} all 200, export shows Audio (2)/Images (0). Server log clean, no SSR
  500s. Worker (comlink + Orama + Vite-8 `new Worker(import.meta.url)`) indexes the seeded data fine.

## Findings / gotchas (M2b)
- Svelte 5 build (Rolldown) **fatally** rejects empty CSS declarations (`;;`) — svelte-pieces'
  svelte-scoped-compiled CSS had them; forced vendoring. `check` only warns on `;;`, build errors.
- House's **runes** components that `{@render children(params)}` (ShowHide, Form) throw
  `invalid_default_snippet` when consumed by **legacy** parents using `let:` → use svelte-pieces
  LEGACY source for those. Runes components also don't forward `on:` events (Search `on:click`→`onclick`).
- `vitePreprocess({ script: true })` needed for TS enums in `<script>`. Svelte 5 a11y warn codes use
  underscores (`a11y_*`) → onwarn filter `startsWith('a11y')`.
- Svelte 5 strict HTML nesting is a build/compile error (`<tr>` needs `<tbody>`, no nested `<form>`).

## Verify each phase
`pnpm --filter=site check` (0 errors; warning count WILL rise — Svelte 5 legacy deprecations, cleaned in M2c) ·
`test --run` · `build` + `node build` boot + curl 200 · browser interaction checks. Lockfile: intended major
bump, so review `git diff pnpm-lock.yaml` for *unexpected* drift only.

## Notes / gotchas as discovered
- (fill in)
