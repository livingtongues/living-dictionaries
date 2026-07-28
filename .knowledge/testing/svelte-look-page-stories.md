# svelte-look page stories — the `$app/stores` gotcha + the `mock_t` helper

Durable lessons from writing `_page.stories.ts` for `[dictionaryId]` info pages.

## `$app/stores` pages can't SSR in svelte-look — use `$app/state`
svelte-look mocks **`$app/state`** only (SSR: it sets a `__request__` Svelte context;
CSR: a Vite shim of `runtime/app/state/client.js` reading `window.__svelte_look_page__`).
It does **not** mock the deprecated **`$app/stores`** store. A component that does
`import { page } from '$app/stores'` and reads `$page` throws during SSR render:

> Cannot subscribe to 'page' store on the server outside of a Svelte component…

(because `$app/stores` in DEV resolves via `getContext('__svelte__')`, which svelte-look
never sets). So **any page/component you want to screenshot must use `page` from
`$app/state`** (`page.data.t`, `page.url` — no `$`). This is also the sanctioned modern
migration (`$app/stores` is deprecated in kit ≥2.12); the repo already had ~10 files on
`$app/state`. When restyling a page for stories, migrate it (and any shared child it pulls
in, e.g. `SeoMetaTags`) off `$app/stores` at the same time.

## Mock the translator with `mock_t`, not the real async `getTranslator`
LD pages render real copy via `page.data.t(key)`. The real `getTranslator` is **async**, but
story `page_data` needs a plain value. `src/lib/mocks/mock-t.ts` exports a synchronous English
`t` (looks up `en` from `$lib/i18n`, splits on the FIRST period like the real
`splitByFirstPeriod`, and runs the real `interpolate` for `{placeholder}` values). Put it in
`shared_meta.page_data = { t: mock_t }`.

## Store-valued page data (the export page)
`entries_data` is a store object: subscribable (`$entries_data`) **with** a `.loading` store
property. Mock it as `Object.assign(readable(records), { loading: readable(false) })`. CSV
formatting reaches into entry shape — an entry with `audios: []` (empty array, not nullish)
crashes `entry.audios?.[0].speakers` (optional chaining doesn't short-circuit a present `[]`);
use `audios: undefined` for media-less entries, and give image/audio entries a
`senses[].photos[].storage_path` / `audios[].storage_path` so the `photoSource`/`soundSource`
filters pick them up.

## Tween/animation timing
`tweened` bars (Progress) render at their START value in a fresh SSR/CSR shot. To screenshot a
filled bar, set `csr: true` and `await` ~ the tween duration in `interactions` before the shot.

## Attachments and portals silently no-op without `csr: true`
Stories default to **SSR only** (`svelte/server`'s `render()` — see svelte-look
`src/render/ssr.ts`), so nothing client-side ever runs: no `{@attach}`, no `use:portal`, no
`$effect`. The failure mode is nasty because it isn't an error — the component renders its
static markup and the missing behaviour just looks like a bug in your code. Hit this building
`$lib/entry-links/` (a DOM attachment rewrites prose into tappable words, and the popover
portals): the story showed plain unlinked text while the real app worked fine.
Any story for behaviour that only exists at runtime needs `csr: true`, plus `interactions` with
a `page.waitForSelector(...)` so the shot happens after the effect lands. The svelte-ui skill
mentions `csr` for "`onMount`/browser APIs" — read that as *anything client-only*, attachments
included.

## Layout stories can't pass a `children` snippet — make the layout's render optional
For page/layout components, svelte-look folds **all** story `props` into `data`
(`props = { data: { ...page_data, ...props } }` in both the SSR path and the CSR
vite-loader). So a `+layout.svelte` story can never deliver a top-level `children`
snippet — `createRawSnippet` in props just lands as `data.children` and the layout's
`{@render children()}` dies with "children is not a function" at render time.
Fix: write the layout as `{@render children?.()}` (harmless in the real app — SvelteKit
always provides it) and give stories no children at all. Applied to
`routes/admin/+layout.svelte` (2026-07-03); same constraint applies in house.
