---
description: Fill the homepage word-card bucket — harvest agent candidates + sweep editor stars from prod, insert as 'suggested' for review at /admin/featured-words
---

# Curate featured words (homepage showcase bucket)

`shared.db.featured_entries` is the candidate BUCKET the homepage word strip is curated from.
Two sources fill it (the `source` column):

- **`agent`** — you harvest public-dictionary entries that have **entry audio + a sense photo**.
  Fill goal: **~5 candidates per public dictionary** that can supply them.
- **`editor_star`** — dictionary editors star favorites in their own dictionaries (per-dict
  dict.db `featured_entries` rows, shown on the dictionary home). Sweep new stars into the
  bucket every run — an editor's taste is a strong signal, but their star is NOT an automatic
  homepage placement (their choice is for their dictionary; the homepage is ours).

Jacob approves/rejects at **/admin/featured-words**; approved cards ship on the next deploy
(build-time bake via `/api/homepage/export` → `fetch-homepage-baked.mjs`). Target pool: 100–200
approved cards. First seed batch (26 cards, 2026-07-04) predates the modal fields — see Backfill.

## Selection principles (from Jacob)

- **Public dictionaries only.**
- **Global geographic spread** — hit every region (Americas, Africa, Asia, Pacific, Europe).
- **Prefer larger dictionaries** (more interesting to click into) but sprinkle small ones.
- **~half English glosses, half other languages** (es/hi/fr/pt/sw/cmn/tpi/el/… — show variety).
- Only lively, appealing photos + clean audio. When in doubt, leave it out.

## Row shape (post-pivot, 2026-07-04)

Card columns (strip): `lexeme`, `gloss`, `gloss_language`, `photo_serving_url` (legacy lh3
hash — '' for R2-convention photos), `photo_storage_path` (copy from the photos row —
renders via `photo_src`), `audio_storage_path`, `dict_name`, `longitude`/`latitude`.
**Modal snapshot columns** (the card's quick-look modal — fill them ALL on every insert):
`phonetic`, `glosses` (JSON MultiString, ALL gloss languages), `speaker_name` (via
audio_speakers→speakers), `example_sentence` (JSON `{ text, translation }` MultiStrings from a
linked sentence, NULL if none). Plus `source` ('agent' | 'editor_star') and `starred_at`
(dict-db star `created_at`, editor_star rows only — the sweep watermark).

## Step 1 — harvest agent candidates on the VPS

Same pattern as before (write a node script locally, pipe through
`ssh living 'docker exec -i sveltekit_blue node'`), but the per-entry SELECT now also pulls the
modal fields:

```sql
SELECT e.id AS entry_id, e.lexeme, e.phonetic, s.id AS sense_id, s.glosses,
  p.id AS photo_id, p.serving_url, a.id AS audio_id, a.storage_path,
  (SELECT sp.name FROM audio_speakers aspk JOIN speakers sp ON sp.id = aspk.speaker_id
   WHERE aspk.audio_id = a.id LIMIT 1) AS speaker_name,
  (SELECT json_object('text', json(st.text), 'translation', json(st.translation))
   FROM senses_in_sentences sis JOIN sentences st ON st.id = sis.sentence_id
   WHERE sis.sense_id = s.id AND st.text IS NOT NULL LIMIT 1) AS example_sentence
FROM entries e
JOIN audio a ON a.entry_id = e.id
JOIN senses s ON s.entry_id = e.id
JOIN sense_photos sp2 ON sp2.sense_id = s.id
JOIN photos p ON p.id = sp2.photo_id
GROUP BY e.id ORDER BY RANDOM() LIMIT 8
```

Skip dicts that already hold ≥5 non-rejected bucket rows (`SELECT dict_id, COUNT(*) FROM
featured_entries WHERE status != 'rejected' GROUP BY dict_id`); dedupe on the existing
`(dict_id, entry_id)` pairs as before.

## Step 2 — sweep editor stars

Per-dict watermark lives IN the bucket: the newest `starred_at` already ingested for that dict.

```sql
-- on shared.db: current watermarks
SELECT dict_id, MAX(starred_at) AS watermark FROM featured_entries
WHERE source = 'editor_star' GROUP BY dict_id;

-- on each /data/dictionaries/<id>.db: new stars (same modal-field harvest as Step 1,
-- but driven by the starred rows; fe.created_at is the star time)
SELECT fe.entry_id, fe.created_at AS starred_at, e.lexeme, e.phonetic, ...
FROM featured_entries fe JOIN entries e ON e.id = fe.entry_id
WHERE fe.created_at > COALESCE(:watermark, '')
ORDER BY fe.created_at
```

- Only ingest stars whose entry has **both** a sense photo and entry audio (the homepage card
  needs both — the schema requires them). Media-less stars are skipped; when the pool runs dry
  you may re-sweep WITHOUT the watermark to reconsider previously skipped/older stars.
- Insert as `source = 'editor_star'`, `status = 'suggested'`, `agent_note = 'editor star swept
  YYYY-MM-DD'`, carrying `starred_at`. Normal filters still apply (public dict, appealing photo —
  vision-check these too).

## Step 3 — select a balanced agent batch

Filter + pick as before:
- `lexeme` = `JSON.parse(sample.lexeme).default ?? first value`; skip empty or > 30 chars.
- Card `gloss`: prefer the target language for the dict's region; skip glosses that are empty,
  > 45 chars, or junk (`ID to be determined`, `??`, `unknown`). **Clean up keepers**: strip HTML
  tags, drop trailing Latin binomials, trim whitespace. Store the FULL cleaned `glosses` map in
  the `glosses` column regardless of which one becomes the card gloss.
- 1–2 cards per dictionary per batch toward the ~5/dict fill goal.

## Step 4 — vision-check every image (mandatory)

Build a contact sheet of `https://lh3.googleusercontent.com/<serving_url>=s150-p` thumbs +
labels, screenshot it headless (browser-tools skill), and **look at it**. Reject:
- clipart / stock-graphic look, watermarked stock (gettyimages etc.)
- literal color squares, broken/blank images
- image-word mismatches, boring/unclear photos
- lexemes in scripts most devices lack fonts for (e.g. Wancho 𞋃𞋜 → tofu boxes)
- human face portrait shots, more zoomed out candid sorts of things are fine

Jacob will check audio on the admin review page: `https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/<url-encoded storage_path>?alt=media`

## Step 5 — insert as 'suggested' on prod

Same stdin-node pattern; include the new columns:

```sql
INSERT OR IGNORE INTO featured_entries
  (id, dict_id, entry_id, sense_id, photo_id, audio_id, lexeme, gloss, gloss_language,
   photo_serving_url, photo_storage_path, audio_storage_path, dict_name, longitude, latitude,
   status, agent_note, source, phonetic, glosses, speaker_name, example_sentence, starred_at)
VALUES (...)
```

NEVER insert as `approved` — Jacob reviews. `UNIQUE (dict_id, entry_id)` makes re-runs safe.

## Backfill (one-time + as-needed)

Rows inserted before the 2026-07-04 pivot have NULL modal fields (the modal degrades
gracefully). When running a curation pass, also backfill any `approved` rows with NULL
`glosses`: re-harvest the modal fields from the source dict DBs by `(dict_id, entry_id)` and
UPDATE the rows in place.

## Step 6 — hand off

Tell Jacob how many agent suggestions + swept editor stars landed and remind him: review at
**/admin/featured-words** (source badges distinguish them; listen to audio there), then the next
deploy bakes approved cards onto the homepage.
