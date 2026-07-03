# Friendly dictionary URLs — fix non-ASCII + Firebase-id slugs, canonical 301

Found during the +1d cutover grace watch (2026-07-03): server 500 `Invalid redirect location`
for dict slugs with chars > U+00FF interpolated into `redirect()` Location headers, plus 30 dicts
with unfriendly `url` values. Decisions settled with Jacob (2026-07-03):

- **Keep `id` untouched** (db filenames, R2 keys, GCS folders, FKs, OPFS/locks all keyed by id).
  Fix the `url` column only. Resolver (`get_dictionary_by_url_or_id`) already does url-first,
  id-fallback → old links keep working forever.
- **Canonical 301 at the SvelteKit level** (not Caddy — mapping is data-driven): in
  `[dictionaryId]/+layout.server.ts`, requested param ≠ `dictionary.url` → 301 to canonical
  (encoded, path + query preserved).
- **Conflict slugs approved:** `aonekko` (Tehuelche 80Cc…), `yoruba-2`, `kiikaonde-2`, `santali-2`.
  NEVER reassign an existing dict's url (url match beats id fallback → link hijack).
- **Data delivery: one-off server-side script** on the VPS (not a .sql migration) — set `url`,
  `dirty = 1`, bump `updated_at`; admin clients pull via normal sync. Back up shared.db first.
- One commit/deploy for the whole package (incl. the new-entry 404 race fix, separate issue file).

## The 31 url updates

| id | new url |
|---|---|
| chabacano-caviteño | chabacano-caviteno |
| denesųłiné-łuwechok-tu | denesuline-luwechok-tu |
| ḍaichyian | daichyian |
| emberá-chamí-catalán | embera-chami-catalan |
| hánačtina | hanactina |
| hñotho | hnotho |
| kmeeṭian | kmeetian |
| laivesòt | laivesot |
| nağaybäk | nagaybak |
| official-yesañ-language | official-yesan-language |
| siebenbürger-saxon | siebenburger-saxon |
| tiłhini | tilhini |
| tudaga-ã | tudaga-a |
| yorùbá | yoruba-2 (conflict: `yoruba` exists) |
| yésah-language | yesah-language |
| zapoteco-de-juárez | zapoteco-de-juarez |
| zazakî | zazaki |
| àfìn | afin |
| дунганский | dungan |
| অসমীয়া | asomiya |
| ḩurīian | huriian |
| jaRhn6MAZim4Blvr1iEv | bahasa-lani |
| 80CcDQ4DRyiYSPIWZ9Hy | aonekko (conflict: `tehuelche` exists, empty+private) |
| AplqDbn7vzVZhGiiYKmJ | runa-shimita |
| zAY0vL2NF3waKYyJEUcS | kiikaonde-2 (conflict: `kiikaonde` exists) |
| QAThAUaCXUaJVLwZeXEz | anihshininiimowin |
| TzgbJBjSo1Pn2GLMsG61 | assamese |
| cH3fbL7uNro07sJMWqry | santali-2 (conflict: `santali` exists, 463 entries public) |
| ykK8VDgz1H2Fbh2LWRgM | itsekiri |
| 6SD8EMju4w312NXb3Y6a | jiwere |
| tér-saami | ter-saami (data bug: url is `"ter-saami\r\n"` with trailing CRLF) |

All verified conflict-free against the live catalog 2026-07-03 (the 4 noted conflicts got suffixes).
9 other non-ASCII-id dicts already have ASCII urls (ngemba, misar-tatar, ewdebe…) — no data change.

## Tasks

- ✅ Canonical 301 in `[dictionaryId]/+layout.server.ts` (+ `canonical-path.ts` helper w/ tests)
- ✅ `encodeURIComponent` in `[dictionaryId]/+page.ts` + `entries/[redirectId]/+page.ts`
- ✅ `[redirectId]` legacy view names: `list|gallery|print|table` → `/entries` (were becoming
      `/entry/list` → 404; seen in prod logs from old-app links)
- ✅ Nav-link sweep `.id` → `.url`: entry page (share fn + SEO url + back-to-entries), PrintEntry QR,
      settings goto, invite buttons ×3, build-citation (+ test fixture), Contact modal,
      admin DictionaryRow ×2, export zip/csv/download names, `operations.ts` insert_entry goto.
      KEPT `.id` for GCS folders (media.ts, settings featured_images, v1 media) — storage paths.
- ✅ create-dictionary URL input: `onkeyup` → `oninput` (mouse-paste hole; server validation
      already bulletproof: `/^[a-z0-9-]+$/` + min length + id/url uniqueness)
- ✅ One-off script `scripts/one-off/2026-07-03-friendly-dict-urls.cjs` (.cjs — scripts/ is
      `type: module`; runs via `ssh living 'docker exec -i sveltekit_blue node' < script`, DRY=1
      env for preview, DATA_DIR override for local)
- ✅ Deployed + data applied 2026-07-03 ~13:00Z: shared.db backed up (`bak-20260703-125623`),
  script ran 31/31 (GOTCHA: 3 ids stored NFD vs script's NFC — script + the server resolver
  now normalize; resolver fix in `903f3276`). Verified live: all 11 legacy ids 301→200,
  15 new slugs 200, Firebase-id links 301 to new slugs, conflict-neighbor dicts untouched,
  legacy /entries/list chains resolve, zero error rows post-deploy.

DONE — remaining follow-ups: none. Safe to delete after a quiet day.

## Verification done (2026-07-03, mustang, local dev server)

- `pnpm test` (1175 passed — build-citation fixture updated for `.url`), `tsc` clean,
  `pnpm check` 0 errors
- curl matrix vs dev server with crafted rows (`tëst-ngəmba`/`test-ngemba`, `tëst-щ-only`):
  legacy-id → 301 canonical (deep path + query preserved); non-ASCII url no longer 500s
  (encoded 307/308); `/entries/list|gallery` → `/entries`; unknown dict → 301 home;
  full legacy chain `/tëst-ngəmba/entries/list` → 2 redirects → 200
- one-off script run against local DB with fixture rows: дунганский → dungan,
  ter-saami CRLF fixed, dirty=1 + updated_at bumped, skip/conflict guards work
- headless puppeteer e2e: login (dev OTP) → create dict → Add Entry `e2eheadword` + Enter →
  lands on `/entry/{uuid}`, headword renders as H1, zero alerts, zero pageerrors
