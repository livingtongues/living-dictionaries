# M2c dedup + Svelte 5 deprecation sweep — ✅ COMPLETE (uncommitted, 2026-07-04)

Directed by Jacob. Scope: converge Legacy* twins onto modern components, eliminate ALL remaining
Svelte-4 patterns, delete dead fixtures, fix stale docs. All done in one session.

## What landed

### A. Dead fixtures deleted ✅
23 `.svx`/`.composition` files (zero references — Jacob confirmed these formats are retired) +
`CheckboxCell.svelte` (fully commented-out corpse) + `ui/Autocomplete.svelte` + `ui/Textarea.svelte`
(zero importers, legacy dispatchers).

### B. ShowHide dedup ✅
34 imports repointed `LegacyShowHide` → modern `ShowHide` (all consumers already used
`{#snippet children(...)}`); `LegacyShowHide.svelte` deleted. `InitableShowHide` was already modern.

### C. Modal dedup ✅
- **Modern `Modal.svelte` adapted**: heading row now renders when `heading || show_x` (was
  `heading`-only) so headingless modals (EditImage, GeoTaggingModal) keep their close X —
  legacy parity. Verified visually.
- All 20 consumers converted: import swap + `on:close` → `on_close` prop. `Contact` +
  `SelectLanguage` (bare `on:close` forwarders) now take/pass an `on_close` prop; their 6
  consumers updated. `LegacyModal.svelte` deleted.

### D. Slideover ✅
`Slideover.svelte` dispatcher → `on_close` callback; ResponsiveSlideover, ColumnAdjustSlideover
(`on_close` prop added), EntriesTable updated.

### E. Maps/mapbox cluster ✅
Callback props replace dispatchers in: Map (`on_ready/dragend/moveend/click/zoomend/error` —
payload passed directly, no `.detail`), Marker (`on_dragend`), Layer (13 `on_*` mouse/touch
callbacks via rest-props lookup), Geocoder (`on_clear/loading/result/result_coordinates/results/error`),
GeolocateControl (5 callbacks). RegionModal + CoordinatesModal now take
`on_update`/`on_remove`/`on_close` props. Consumers converted: WhereSpoken, DictionaryPoints,
Region, DictionaryRow, GeoTaggingModal.

### F. Misc dispatchers ✅
PrintAccessCheckbox + PublicCheckbox → `on_changed({ checked })` (settings page updated, no more
`{ detail }`); DownloadMedia → `on_completed` (export page updated).

### G. svelte/legacy fully eliminated ✅ (28 files)
- `preventDefault`/`stopPropagation` wrappers → inline `(e) => { e.preventDefault(); … }` (9 files).
- `createBubbler` in Image + PlayVideo: `bubble('click')` was DEAD forwarding (no consumer passes
  onclick) → plain `e.stopPropagation()`.
- `run()` → **`$effect` for side-effects** (Keyman, AuthModal, UploadImageStatus, EditImage, Popup,
  PopupOfMap, SetLanguage, GeoJSONSource, VectorSource, EditAudio, VirtualList, MultiSelect,
  create-dictionary, entries/+page, Pagination, routes/+page private-dicts fetch) and
  **`$derived` for pure assignments** (SSR-correct: Search currentDictionary + filteredDictionaries,
  SearchDictionaries filteredDictionaries, routes/+page selectedDictionary, MapboxStatic src).
- ModalEditableArray: seed `prepareSelected(values, options)` once at init (SSR-visible chips)
  + `$effect` for updates — the 2 new `state_referenced_locally` warnings there are deliberate.

### H. Docs ✅
- `.knowledge/migration/index.md`: removed the entry for `svelte-5-runes-migration.md` (page was
  deliberately deleted in commit 90dd171b; index link was stale).
- `.claude/skills/svelte-ui/SKILL.md`: rewrote stale `$lib/svelte-pieces` references →
  `components/ui/` / `utils/` / `state/` reality.

### Stories added (visual verification surface)
New: Contact, SelectLanguage, AuthModal (csr), AddSpeaker, EditImage, EditableGlossesField (csr
modal-open), SearchDictionaries (csr modal-open), ModalEditableArray (csr modal-open), AddVideo,
EditAudio, EditFieldModal, ColumnAdjustSlideover (csr), CoordinatesModal (csr, real mapbox load),
RegionModal (csr), GeoTaggingModal (csr). Plus shared mocks file
`src/lib/mocks/svelte-look-mocks.ts` (default `t`/locale/auth_user).
Gotcha for future stories: modal screenshots need a ~350ms settle after `.modal-card` appears
(fade transition) or the card captures semi-transparent.

## Verification (all green)
- `pnpm check` 0 errors (35 warnings — 33 baseline + 2 deliberate ModalEditableArray init-captures)
- `pnpm lint` clean · `pnpm test -- --run` 1218 pass / 3 skipped (Δ from 1222 = concurrent
  session's markdown test removals, not this work)
- grep-zero: `createEventDispatcher`, `svelte/legacy`, `<slot`, `export let`, `on:` events,
  `Legacy*` — ALL 0
- svelte-look light+dark: EditSource, EntrySource, EditableOrthographies, Contact, SelectLanguage,
  AddSpeaker, EditImage (headingless-X case), AuthModal, EditableGlossesField, SearchDictionaries,
  ModalEditableArray, AddVideo, EditAudio, EditFieldModal, ColumnAdjustSlideover, CoordinatesModal,
  RegionModal, GeoTaggingModal (headingless-X case)
- headless dev-server smoke (mustang): homepage (Search/map cluster), Header→Contact modal open,
  achi/entries — ZERO pageerrors (only external CORS noise: google gsi + dummy mapbox token)

## Not screenshot standalone (pattern-covered, check-verified)
- Keyman select-keyboard modal (needs external KeymanWeb script + interaction chain)
- entries/View + entry/[entryId] history modal (route-level; were ALREADY on `on_close` prop —
  import swap only)
- WhereSpoken (map-cluster callbacks — same converted patterns as the verified modals)

## Tree-sharing note
The cutover grace-watch session's uncommitted work (scripts/supabase reorg, markdown shim removal,
.issues/cutover.md deletion) is interleaved in the same dirty tree — its `EditField.svelte` etc.
changes are NOT from this session.
