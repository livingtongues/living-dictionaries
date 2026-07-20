# Media-by-reference — shared audio across entries + homophone-set UX (design-first)

Source: agent feedback thread `434cc872-4582-418d-87b9-6128ad311327` (River, 2026-07-18, marked
resolved 2026-07-19), building on the homograph field + `homophone` relationship type
(`.issues/v1-api-quick-wins.md` §2–3 — **land those first**; this issue keys off them).

**Jacob decision (2026-07-19): full design-first issue — schema options analyzed, recommendation
made, API + UI phased. Builder starts with the design below validated against the schema, not from
scratch.** Per AGENTS.md parity direction: every capability ships BOTH a v1 API surface and a human
UI surface, through one shared server module.

## Problem

Same-dialect homographs are true homophones — ONE citation-form recording is correct for every member
of the set (e.g. six unrelated entries pronounced identically). Today the only way to give them all
audio is uploading the same file N times: N× storage, and a re-recording means N updates that drift.
Also useful beyond homophones: a compound sharing its head-word's recording; one speaker's greeting
reused on a phrasebook variant.

## Current schema (verified 2026-07-19)

- `audio` (`$lib/db/schemas/dictionary.ts:164`): one row per recording with **direct nullable owner
  FKs** — `entry_id` / `sentence_id` / `text_id` (exactly one set), `storage_path` NOT NULL,
  `source`, `timings`. Speakers via `audio_speakers` junction.
- Photos + videos ALREADY use the by-reference model: media row + junction tables
  (`sense_photos`, `sentence_photos`, `sense_videos`, `sentence_videos`) — a photo/video row is
  ownerless; junctions attach it. **Audio is the odd one out.**

## Schema options

| | Option A: additive `audio_shares` junction | Option B: migrate audio to the photo/video junction model | Option C: duplicate audio rows sharing one `storage_path` |
|---|---|---|---|
| Shape | keep `audio.entry_id` as the OWNER; new junction `audio_shares (id, audio_id, entry_id, created_*, updated_*, dirty, server_seq)` attaches the same recording to more entries | drop owner FKs, add `entry_audio` junction; every attachment equal | new `audio` rows, same bytes path |
| Migration risk | none — purely additive table | rewrite every audio row + all read paths (entry page, karaoke, exports, v1, snapshot consumers) across synced client DBs | none |
| Detach semantics | delete junction row; owner delete = media delete (shares die by cascade) | delete junction row; media dies when last junction goes (needs GC) | delete row; storage GC must refcount paths |
| "Shared vs own" distinction (the UX wants it) | free — owner FK vs share row | lost — needs an extra `role` column | ambiguous |
| Long-term cleanliness | audio stays inconsistent with photos/videos | consistent | worst |

**Recommendation: Option A.** The UX explicitly wants owner-vs-shared to be visible ("a curator can
always tell a shared recording from an entry-specific one and replace either independently") — the
owner-FK + share-junction split encodes exactly that. Zero migration of existing rows keeps sync risk
at ~nil. Option B remains a possible future convergence but is not needed for the feature and touches
every audio read path in a synced fleet. Scope shares to **entry-level audio only** for now
(sentence/text audio sharing has no demand).

- dict.db migration: `audio_shares` table (FKs `audio_id` → audio CASCADE, `entry_id` → entries
  CASCADE, UNIQUE(audio_id, entry_id)); syncable; tombstone-delete like other junctions.
- Read model: an entry's audio = own rows (`audio.entry_id = X`) ∪ shared rows (via `audio_shares`),
  each flagged `shared: true` + carrying the owner entry id/lexeme. Touch: entry page read, worker
  read-model (check `.knowledge/db/m4-sqlite-read-layer.md` + PARITY manifest before touching
  worker files), v1 entry reads, exports (CSV filename logic — shared audio should not double-count),
  snapshot consumers (additive table ships automatically via full backup).

## Guardrails (from the feedback — treat as requirements)

1. Sharing is scoped WITHIN a dialect — a cognate in another dialect spelled identically is NOT the
   same pronunciation. Server validates: share target must overlap ≥1 dialect with the owner entry
   (or both dialect-less).
2. Deliberate + visible, never silently automatic by spelling: shares are explicit rows a curator
   creates; shared playback shows a "shared pronunciation" indicator.
3. An entry-specific upload OVERRIDES the shared one for that entry only (own rows sort before
   shared in the read model; UI plays own audio when present).

## Phases

### Phase 1 — API (agent surface)
- `POST /api/v1/dictionaries/{id}/entries/{entryId}/audio/shares` `{ audio_id }` — attach existing
  audio (must be entry-owned audio in this dict; dialect guardrail enforced; 409 on duplicate).
- `DELETE …/entries/{entryId}/audio/shares/{audioId}` — detach (link only, media survives).
- Entry reads include shared audio with `shared: true` + `owner_entry_id`.
- Shared server module (e.g. `$lib/db/server/audio-shares.ts`) so Phase 2 UI reuses it.
- openapi + guides (homophone workflow: set homograph numbers → add `homophone` relationships →
  share one recording).

### Phase 2 — UI (curator surface)
- Entry page audio section: shared recordings render with a subtle indicator + "from {lexeme}" link;
  detach control for editors.
- On upload to an entry that has same-dialect homophone set-mates (same lexeme+dialect, distinct
  homograph numbers, and/or `homophone` relationships): offer one-tap "share with its N homophones"
  (creates share rows).
- A set member with no own audio plays a set-mate's shared recording with the indicator (only when a
  share row exists — guardrail 2, no implicit spelling-based sharing).
- svelte-look stories + screenshots for the indicator/prompt states.

### Phase 3 (optional, later) — extend shares to senses/sentences if demand appears; revisit
Option B convergence only if audio's split model causes real maintenance pain.

## Acceptance
- Migration applies cleanly on fresh + existing dev DBs (server AND wa-sqlite client path).
- Sync round-trip test: share created on one client appears on another; tombstone detach propagates.
- Guardrail tests: cross-dialect share rejected; duplicate share 409; owner-delete cascades shares.
- `pnpm test` / `tsc` / `pnpm lint` / `pnpm check`; PARITY manifest check if worker files touched.
