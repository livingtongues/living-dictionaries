# Media attribution: speaker and/or registry source (audio + video)

Decided with Jacob 2026-07-02 (`.issues/media-attribution-speaker-or-source.md`). The code shows
*what* the rules are; this page records *why* — do not relitigate.

## The rule

- **Audio + video writes require attribution**: `speaker_id` (an `audio_speakers`/`video_speakers`
  junction) and/or `source` — enforced **write-time only** (v1 API in `attach_media` + route
  pre-checks; UI via the `SelectSpeaker` gate). No DB constraint, no backfill: legacy rows may be
  unattributed (4,079 legacy audio were), and `remove_source_from_all` may legally strip a row's
  only attribution.
- **`audio.source` / `videos.source` are STRICT `sources.slug` registry refs** (single scalar slug,
  no FK — same write-validate + delete-integrity-sweep model as the entry/sentence/text slug
  arrays). Same create-first strictness agents already learned for entry sources.
- **`photos.source` is deliberately NOT a registry ref** — it's free-text caption/attribution prose
  shown under the image. Legacy data proved the semantic split: 592 distinct caption-like values
  over 9,468 photos vs 14 person-names over 605 audio.

## Why speaker-or-source (not speaker-only)

Speakers are real people (birth decade / gender / birthplace, shown on the contributors page and in
CSV exports). Forcing a speaker for archival/website audio would have produced fake person rows —
the river import (hmongdictionary.us) had 4,733 speaker-less audio that would each have needed a
fake "hmongdictionary.us" person. Provenance belongs in the sources registry; the openapi guide
explicitly tells agents to NEVER invent a placeholder speaker.

## Why registry slugs (not free text) — and the pre-cutover timing

Locked in pre-cutover because migration cost was near zero: legacy audio.source held only 14
distinct person-name strings (dedupe-able trim/case variants), videos had none, and the river
import had exactly one distinct value. Slugs give deterministic attribution, one mental model
across the API, UI reuse of the existing source picker/EditSource, and future facet potential.

## Cutover + prod facts (not recoverable from code)

- **Cutover resolution** of legacy person-name audio sources is the mechanical 3-rule
  `resolve_audio_source_names` (match-speaker → link; all-unlinked → create speaker;
  linked-to-others → registry citation). The per-value legacy data table backing the rules lives in
  `.issues/media-attribution-speaker-or-source.md`; raw JSON stats sat in
  `.issues/tmp-legacy-*.json` on tuf (untracked, disposable).
- **river.db prod backfill ran 2026-07-02** (`/tmp/river-backfill.js` via `ssh living` +
  `docker exec`, idempotent): created source `hmongdictionary-us` (citation `hmongdictionary.us`,
  type `dictionary`) and rewrote all 4,733 `audio.source` free-text values to the slug, bumped
  `updated_at` (client sync pickup) and mirrored the cursor to shared.db (snapshot rebuild).
  ⚠️ The import agent may keep POSTing free-text `source: 'hmongdictionary.us'` until the
  enforcement deploy lands — re-run the backfill query after deploy if new free-text rows appeared.
- The river agent independently created entry sources (`heimbach-1979`, `english-white-hmong`)
  before media sources were slug-typed — evidence the strict create-first model works for agents.
