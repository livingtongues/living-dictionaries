# Entry-page isomorphic SSR + real OG (house-pattern)

Make entry pages SSR real content + real OG meta on first paint, while warm client nav stays
ping-free. Audit + rationale: `.issues/audit-entry-ssr.md`. Modeled on house's
`/api/chapter` + universal `+layout.ts` isomorphic reader.

## Decisions (locked with Jacob)

- **Q1 assembler:** ONE pure `assemble_entry_data` shared by the server endpoint AND the client
  worker's `process_entry` (worker delegates its final shaping to it) + parity/contract test.
- **Q2 endpoint auth:** soft-auth like house `/api/chapter` — anonymous → `admin_level 0` (public
  tags only); resolve session → real `get_admin_level(email)` so admins' SSR matches their client.
- **Q3 cold deep-link:** keep eagerly downloading the full dict.db (snappy jumping). The server
  endpoint serves the single entry during the cold window via the `synced`/`loading` flag.
- **Q4 synced signal:** reuse `entries_data.loading` — `+layout.ts` awaits `sync_now()` before
  building the store; `loading` flips false only after the full bundle is assembled, so
  `!loading && !entries_data[id]` = genuinely missing → confirm via endpoint.
- **Q5 not-found:** load calls SvelteKit `error(404)` when the endpoint returns no entry.
- **Body SSR (follow-on Q1=B):** add a `entry_row ?? entry.main` / `sense_row ?? sense` read-model
  fallback in `EntryDisplay`/`Sense` so lexeme/glosses/phonetic render server-side before the live
  db opens. `entry.main` and the live `entry_row` share scalar field names, so the fallback is a
  clean per-component derived with a seamless swap once the live row arrives, and **no hydration
  mismatch** (entry_row is null at hydration → SSR and first client paint both use the read-model).

## Key facts discovered

- SSR currently returns a `"Loading..."` stub (`entry/[entryId]/+page.ts:5-17`); empirically the
  shared entry `<head>` carries `title="Loading… | <Dict> Living Dictionary"` + `og:image`=default
  logo. OG generator dormant.
- Read-model EntryData (`entry.interface.ts`) is representation #2 — the SEO/search/list skeleton.
  Editing operates on representation #1, the live `DictLiveDb` row (`EntryDisplay.svelte:34-40`,
  `Sense.svelte:26-32`). The shared assembler only builds #2 → does NOT touch `_save()` slickness.
- Client assembler = `process_entry` in `lib/search/entry.worker.ts:552` (over in-memory grouping
  maps). Bundle read: `read-dict-bundle.ts`. Worker is a comlink Worker (`expose-entry-worker.ts`)
  → can import a shared module; hard to import in a unit test (test the shared fn + server gather).
- Dict DB is keyed by the **real dict id**, not the URL slug. `+layout.server.ts` resolves slug→row
  (`dictionary.id`). So `+page.ts` must call the endpoint with `dictionary.id` from `await parent()`.
- Server reads: `get_dictionary_db(dict_id)` + `query_all` (`typed-query.ts`, parse_row applied).
  In-memory for tests: `open_dictionary_db_in_memory(dict_id)`.
- Soft-auth helpers: `verify_auth(event)` (throws if none) → `get_admin_level(email) ?? 0`;
  tag visibility `should_include_tag(tag, admin_level)` (`lib/helpers/tag-visibility.ts`).
- `entries_data` store: `subscribe` (Record<id,EntryData>) + `.loading` writable. Use `get()` for
  sync snapshots in the load.
- SvelteKit: universal load `fetch` is in-process on SSR + **reused-from-HTML on hydration** (no
  refetch), real network only in a genuine cold client nav. Server load keyed on `entryId` would
  `__data.json`-ping every warm nav → that's why we keep a universal `+page.ts` + endpoint, NOT a
  `+page.server.ts`.

## STATUS: implemented + verified ✅ (all steps done)

Empirically verified on :3041 — `apatani/entry/7fvCVSvsPXJzcWhnMpZF` SSR now serves real
`<title>`, real `og:title`/description, real body text, a working `/og` PNG card, and 404s on a
bad entry id. See "Discovered + fixed" and "OPEN for Jacob" below.

### Discovered + fixed (in scope: "OG generator not in action")
- `routes/og/component-to-png.ts` used the **Svelte-4** `Component.render(props)` (removed in
  Svelte 5) → `/og` 500'd for ANY real props. Fixed to `render(component, { props })` from
  `svelte/server` using `.body` (+ strip hydration comment markers). `/og` now returns a real
  1200×600 PNG. This was the render-layer half of "the OG generator isn't in action."

### Photo-less OG cards — RESOLVED ✅ (Jacob chose targeted)
- Added a `generate_og_image` prop to `SeoMetaTags.svelte`; the gate is now
  `gcsPath || generate_og_image ? '/og?…' : DEFAULT_IMAGE`. The entry `+page.svelte` sets
  `generate_og_image`, so EVERY entry (photo or not) gets a real `/og` card — photo card when it
  has one, globe + lexeme + gloss card otherwise. Other callers (dictionary/about/home) are
  unchanged (still logo unless they pass a photo). Verified: `achi/entry/e_ja` (no photo) → 1200×600
  globe card PNG.

## Build steps

- [x] **1. `lib/search/assemble-entry-data.ts`** — pure `assemble_entry_data(input)` → EntryData.
      Takes grouped+sorted slices (entry row; senses[] sorted by created_at, each with
      sentences/photos/videos pre-grouped; audios[] sorted with speakers attached; resolved tags[];
      dialects[]; admin_level). Strips bookkeeping → `main`, strips `entry_id` off senses,
      `should_include_tag` filter, conditional `audios`/`tags`/`dialects`. + `*.test.ts` (fixtures
      incl. admin tag filtering: private hidden at 0/shown at 2, `v4` only at 2).
- [x] **2. `lib/db/server/build-entry-data.ts`** — `build_entry_data({ db, entry_id, admin_level })`
      → EntryData | null. ~12 scoped `query_all`s (entry; senses ORDER BY created_at; audio +
      audio_speakers + speakers; entry_tags + tags; entry_dialects + dialects; per-sense
      senses_in_sentences + sentences, sense_photos + photos, sense_videos + videos + video_speakers),
      build grouped slices, call `assemble_entry_data`. + `*.test.ts` against `open_dictionary_db_in_memory`.
- [x] **3. Refactor `entry.worker.ts` `process_entry`** to delegate final shaping to
      `assemble_entry_data` (feed slices from its maps; keep maps for perf). Verify no dup/order regress.
- [x] **4. `routes/api/dictionary/[id]/entry/[entryId]/+server.ts`** GET + `_call.ts`
      (`get_dict_entry({ fetch, dict_id, entry_id })` using the load's fetch) + `server.test.ts`
      (404 missing; returns entry; soft-auth anon vs admin tags). Returns `{ entry: EntryData | null }`.
- [x] **5. Rewrite `entry/[entryId]/+page.ts`** — universal isomorphic load:
      SSR/cold → endpoint (404 if null); warm+present → live `derived_entry`; warm+missing →
      endpoint-confirm (404). Returns `{ entry_from_page?, derived_entry?, shallow:false }`.
- [x] **6. `entry/[entryId]/+page.svelte`** — `entry = $derived($derived_entry ?? entry_from_page)`.
- [x] **7. `EntryDisplay.svelte` + `Sense.svelte`** — `const fields = $derived(entry_row ?? entry.main)`
      / `const sense_fields = $derived(sense_row ?? sense)`; point value reads at the fallback.
      Keep `save_*` guarded by `if (!entry_row) return` (no-op until live row present).
- [x] **8. Verify** — `pnpm test` (new tests), `tsc`, `pnpm check`; curl `:3041/achi/entry/e_ja`
      → real `<title>`, `og:image=/og?...`, real body text in SSR HTML; confirm warm nav still
      0 server pings (network tab / no `__data.json`).

## Risks / watch

- Parity drift between worker grouping (maps) and server grouping (SQL) — covered by the contract
  test asserting server output equals a hand-authored expected EntryData for a rich fixture.
- Object key order differs server vs client — irrelevant to hydration (DOM compares values).
- `entry.main` has `coordinates` (used by EntryMedia) — already read from read-model, SSRs fine.
- Private dicts: keep `norobots` (already wired via `dictionary.public`).
