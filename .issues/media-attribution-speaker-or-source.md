# Media attribution: require speaker OR registry-source on audio + video (API + UI + cutover + river backfill)

## Decisions (finalized with Jacob 2026-07-02 — do NOT relitigate)

1. **Audio + video attach requires attribution: `speaker_id` OR `source`.** Enforced write-time
   only (no DB constraint, no backfill requirement for old rows). Photos unchanged.
2. **`audio.source` + `videos.source` become STRICT `sources.slug` refs** (single scalar slug in
   the existing TEXT column — one recording, one origin; no array, no FK — matching the
   entries-array pattern: write-time validation + delete-integrity sweep).
   **`photos.source` stays free text** (caption/attribution prose semantics — legacy data: 592
   distinct caption-like values over 9,468 rows).
3. **UI parity**: SelectSpeaker (shared by EditAudio + AddVideo) gets a "speaker unknown →
   attribute a source instead" path using the existing source picker + EditSource modal (NOT a
   bare text input). Display fallback: where the speaker name shows (entries-table speaker cell,
   audio modal), fall back to the source's `abbreviation || citation || slug`, dimmed/italic.
4. **Errors are actionable + contextual**: missing attribution → explain both options with exact
   endpoints; unknown `speaker_id` → include the dict's existing speakers (id + name) when ≤ 20;
   unknown source slug → "create it via POST …/sources first" (same strict model entries already
   use).
5. **Cutover** converts legacy free-text media sources: per-value curated mapping — person names
   that should be speakers become speaker links; genuine citations become registry rows (see
   "Legacy data findings" below). Videos: nothing to do (0 rows with source).
6. **River.db (prod, new VPS)**: backfill — create one sources-registry row for
   `hmongdictionary.us`, rewrite all 4,733 `audio.source` values to its slug.
7. Deletion policy: `count_source_references` + `remove_source_from_all` extend to audio/videos.
   Remove-from-all may leave audio with neither speaker nor source — legal (write-time-only
   enforcement, same status as the 4,079 legacy unattributed rows).

## Legacy data findings (prod Supabase, 2026-07-02, excluding deleted)

| Table | Total | With `source` | Distinct | Nature |
|---|---:|---:|---:|---|
| audio | 142,492 | 605 (0.4%) | 14 | contributor person-names (trim/case dupes exist) |
| videos | 435 | 0 | 0 | unused (`videographer`/`hosted_elsewhere` instead) |
| photos | 21,643 | 9,468 (43.8%) | 592 | photographer names + 1 real citation (Wayeb ×206) |

- 4,079 legacy audio rows are fully unattributed (no speaker, no source).
- No dictionary has unique-per-row prose in audio.source (max 2 distinct per dict).
- Raw stats: `.issues/tmp-legacy-media-source-stats.json` (on tuf). Per-value speaker-match
  mapping data: `.issues/tmp-legacy-audio-source-mapping.json` (tuf session 7479f157, in flight).
- Fold BOTH into `scripts/supabase-cutover/` as a checked-in mapping/spec before cutover; delete
  the tmp files after.

## Coordination

- ⚠️ Session d24d8211 is concurrently doing the CKEditor→Tiptap migration and has modified
  `site/src/lib/api/v1/openapi.ts` + `entry-input.ts`. Keep openapi edits surgical (media
  section only); don't touch entry-input.ts; never commit/revert its files.
- The river import agent posts `source: 'hmongdictionary.us'` (free text) today; after deploy its
  POSTs 400 with create-first guidance → self-corrects. openapi must document the new rule.

## Plan

### 1. Config drift fix ✅
`scripts/config-supabase.ts` prod branch now loads `scripts/.env.supabase` first, legacy
`../site/.env.production.local` kept as fallback. Verify via tuf (`-e prod` connect).

### 2. Server enforcement (`site/src/lib/db/server/v1-media-write.ts` + route handlers)
- `attach_media`: for audio/video cells require `speaker_id || source`; validate source slug via
  `load_source_slug_set` (import from `./source-slugs`, avoids cycles); keep speaker existence
  check. Photos: `source` free text unchanged.
- `media-route-handlers.ts` pre-checks BEFORE byte upload (no orphaned bucket bytes):
  - missing both → 400 listing both remedies with concrete endpoints
  - unknown speaker → 400 + inline speaker list (id + name) when ≤ 20 speakers
  - unknown slug → 400 create-first message
- `v1-sources.ts`: `count_source_references` gains `audio` + `videos` counts (scalar column:
  `WHERE source = ?`); `remove_source_from_all` NULLs media source (merge_dict_row path);
  delete-refused message includes media counts.
- Slug rename note: sources UI hides slug rename once referenced — reference check must include
  media refs (find where that's computed).
- Tests: `v1-media-write.test.ts`, `v1-sources.test.ts`, route `server.test.ts` files.

### 3. openapi + docs (`site/src/lib/api/v1/openapi.ts`, `routes/api/v1/+server.ts` HTML blurb)
- audio/video attach: `source` described as strict registry slug; requirement "speaker_id or
  source (at least one)"; 400 descriptions updated; photo `source` description unchanged
  (caption). Media section of the guide updated.

### 4. Client/UI
- `SelectSpeaker.svelte`: add "speaker unknown? attribute a source instead" link → source
  autocomplete over `page.data.sources` + "create new" via EditSource modal. Children snippet
  gains `source_slug` alternative; callers updated.
- `EditAudio.svelte` + `AddVideo.svelte`: thread `source` through upload; for existing media
  allow viewing/changing attribution (assign speaker OR set source).
- Write path: `operations.ts` `insert_audio`/`insert_video` + `helpers/media.ts` +
  `dict_db.writes.insert_audio` accept `source` (slug); client-side gate: one-of before upload.
- Display: `SelectSpeakerCell.svelte` falls back to source label (`abbreviation || citation ||
  slug` from `page.data.sources`), dimmed/italic. Check entry-detail audio display for same.
- svelte-look stories: SelectSpeaker source path, speaker-cell fallback. Visual verify.

### 5. Cutover (`scripts/supabase-cutover/`)

**Legacy audio.source per-value data (prod, 2026-07-02)** — 14 distinct values, 605 rows, ALL
person names (full JSON: `.issues/tmp-legacy-audio-source-mapping.json` on tuf):

| Source | Dict | rows | already-linked | matching speaker in dict |
|---|---|--:|--:|---|
| Yafeth Warijo | Bahasa Lani | 298 | 0 | none (dict has 0 speakers) |
| javier domingo | Tehuelche | 226 | 226 | ✓ |
| Marvin Richardson | Tutelo-Saponi | 27 | 27 | ✓ |
| victoria␣ (trailing sp) | Zapoteco sierra norte | 20 | 15 | none (5 speakers) |
| Ciriaco Alavez Bautista (+1 CASE dupe) | Zapoteco serrano | 12 | 0 | none |
| Matthew Richardson | Tutelo-Saponi | 7 | 1 | ✓ |
| Daniel Bögre Udell | Hebreo | 4 | 4 (to OTHER speakers) | none |
| Daniel Bögre Udell | Frases en quechua | 3 | 3 | ✓ |
| Alex Larkin / Risuin␣ / Jacqueline␣ / Luke / Matthew Windsor / felix odeli | various | 1–2 | mixed | Windsor+odeli ✓ |

**Mechanical rule (no curated file), per (dict, trimmed+case-folded name):**
1. Matching speaker exists in dict (trim/lower name equality) → ensure `audio_speakers` link on
   every row with this source (insert missing), NULL the source. (javier 226 drop-redundant,
   M. Richardson +6 links, Windsor, odeli, Daniel@quechua.)
2. No matching speaker AND every row with this source is speaker-less → the name IS presumed the
   speaker: CREATE one speaker (trimmed name, most-frequent casing variant; case-dupes collapse),
   link all rows, NULL source. (Yafeth 298, Ciriaco 12, Larkin, Risuin, Jacqueline, Luke.)
3. Else (mixed: some rows link to OTHER speakers — recorder semantics, Daniel@Hebreo, victoria) →
   sources-REGISTRY row (slug = slugify(name), citation = raw name), rewrite `audio.source` = slug,
   shared registry with `build_dict_sources` (dedupe by slug).
- videos: nothing (0 legacy rows with source). photos: untouched (caption).
- Tests in `migrate.test.ts` for all three branches.
  (Note pre-existing unrelated failures documented in `.issues/sources-model.md`.)

### 6. River.db prod backfill (ssh living, docker exec node script)
- Create `sources` row: slug `hmongdictionary-us` (slugified), citation `hmongdictionary.us`,
  url if verifiable, type `dictionary`.
- `UPDATE audio SET source = slug, updated_at = now WHERE source = 'hmongdictionary.us'` via
  proper write path (bump `updated_at`; lmod triggers bump sync cursor; check database skill for
  server-side write conventions + snapshot rebuild flag / `mirror_dictionary_cursor` equivalent).
- Verify: re-query; check a browser client picks up changes (or snapshot rebuild flag set).

### 7. Wrap-up
- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check` in /site.
- Update `.issues/cutover.md` checklist with the media-source mapping step.
- Knowledge: add media-attribution model rationale to `.knowledge/domain/` (registry-slug on
  audio/video vs caption free-text on photos; why speakers must not be faked).
- Delete tmp stats files after folding into cutover docs.

## Status — COMPLETE (2026-07-02)
- ✅ Config drift fix (`scripts/config-supabase.ts` prod branch now loads `scripts/.env.supabase`
  first, legacy site path kept as fallback). Code-path verification on tuf happens after this is
  pushed/synced there (the tuf investigation session validated the creds file works).
- ✅ Server enforcement + tests — `attach_media` (speaker-or-source + strict slug for audio/video),
  route pre-checks with actionable 400s (endpoints + inline speaker list ≤20 + inline slug list),
  `v1-sources` ref-counting/remove-from-all/delete-refusal extended to audio+videos, client
  `remove_source_and_delete` + sources-page usage query extended. 1020 site tests green.
- ✅ openapi/docs — attribution rule + slug semantics on all audio/video paths, "NEVER invent a
  placeholder speaker" guidance, photo caption clarified, `/api/v1` HTML blurb fixed (was stale:
  said "not media").
- ✅ UI + stories — SelectSpeaker "Speaker unknown? Cite a source instead" path (source picker +
  EditSource create), EditAudio/AddVideo thread `source_slug` (upload + hosted + re-attribution of
  existing audio via `update_audio`), SelectSpeakerCell dimmed/italic source fallback. All
  svelte-look stories screenshot-verified. Incidental fix: SelectSpeaker's `bind:value` select
  could mount with browser-chosen "+ Add" when speaker_id was undefined — now inits to `''`.
- ✅ Cutover — `resolve_audio_source_names` 3-rule mechanical resolution (tests green), wired into
  `migrate.ts` (speakers/audio buffered until audio_speakers), `.issues/cutover.md` step added.
- ✅ River backfill (prod, 2026-07-02) — created `hmongdictionary-us` source row, rewrote all 4,733
  audio rows, bumped updated_at + mirrored cursor (snapshot rebuild pending cron). ⚠️ Re-run
  `/tmp/river-backfill.js` (idempotent) after the enforcement DEPLOYS if the river import agent
  created new free-text rows in the gap.
- ✅ Wrap-up — knowledge page `.knowledge/domain/media-attribution.md`; tests/tsc/svelte-check/
  eslint all green (scripts workspace has pre-existing unrelated tsc/test failures, documented in
  `.issues/sources-model.md`).

### Notes for a future session
- tuf holds untracked `.issues/tmp-legacy-media-source-stats.json` +
  `tmp-legacy-audio-source-mapping.json` (raw prod-Supabase stats) — disposable; the durable
  summary is in this file + the knowledge page.
- Concurrent Tiptap session (d24d8211) also had `openapi.ts`/`entry-input.ts` modified — my edits
  were confined to the media section; check for merge friction before committing.
- en.json gained `source.cite_instead` / `source.select_source` / `source.choose_speaker_instead` /
  `source.source` (other locales fall back to EN via dynamicKey fallbacks until translated).
