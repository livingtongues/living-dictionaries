# Star featured entries for every public dictionary's /home page

Goal: for each of the 221 public dictionaries, star (dict.db `featured_entries`) up to 6
entries — best first — to seed `/[dictionaryId]/home`'s featured strip. This is a WIP
admin-only page (not yet public-facing), and this pass exists to fuel a future
`curate-featured-words` sweep (its `editor_star` source), so good-faith curation is enough —
Jacob does a final quality pass downstream.

Selection principles: same as `.claude/commands/curate-featured-words.md` (appealing photos,
no clipart/stock-graphic look, no watermarks, no broken/blank images, no image-word mismatches,
no human faces, no unrenderable/tofu scripts). Tiering rule (from Jacob):
1. Prefer entries with BOTH sense-photo + entry-audio — up to 6, best first.
2. If a dict has none with both, take the best 3 photo-only entries.
3. If no photos at all, take the best 3 audio-only entries (judged by a duration/volume
   heuristic via ffprobe/ffmpeg `volumedetect` — no vision needed, no human listening).
4. If literally nothing qualifies (no photo, no audio anywhere), skip (0 stars).

## Scale (from harvest, see `harvest.json`)

221 public dicts total:
- 53 skip (no media at all)
- 47 `both_full` (≥6 candidates with both photo+audio)
- 24 `both_partial` (1-5 with both)
- 18 `photo_only` (no "both" candidates, but photos exist)
- 79 `audio_only` (no photos anywhere, but audio exists)

→ 89 dicts need photo vision-review (contact sheets, batches of 6 dicts each ≈ 15 batches,
processed largest-entry_count-first). 79 dicts are audio-only (fully automated, no vision
needed) — **DONE**, see `audio-only-picks.json` (233 entries chosen across 79 dicts).

## Mechanics

- Attribution: `created_by_user_id`/`updated_by_user_id` = Jacob's real user id
  `f0fdbb2f-b87d-4717-8858-37e64efeb112` (no dedicated "agent" system user for dict-scoped
  tables; every dict.db already has this user row since he's an implicit admin on every dict).
- Writes go directly into each `dictionaries/<id>.db` on the VPS via
  `docker exec -i sveltekit_blue node --input-type=module` (same raw-SQL-over-SSH pattern as
  the `curate-featured-words` command uses for `shared.db`) — NOT through the `/api/v1`
  write path (no per-dict API key needed), and NOT through `merge_dict_row` (no history-log
  entry gets recorded for these — acceptable for this bulk seed, matches how
  `curate-featured-words`' own shared.db writes are historyless too).
- Row shape: `featured_entries(id, entry_id, sort_key, created_at, created_by_user_id,
  updated_at, updated_by_user_id)` — `dirty` stays NULL (server-authoritative write, nothing
  to push). `sort_key` = fractional index (`initial_keys`-style, see
  `$lib/api/v1/fractional-index.ts`), best-first = smallest key first.
- IMPORTANT: `featured_entries` table/triggers may not exist yet on a dict.db that hasn't been
  opened by the app since the 2026-07-04 migration deployed — the insert script must run the
  migration file's `CREATE TABLE IF NOT EXISTS` / triggers (or open via a path that runs
  `run_sql_migrations`) before inserting.

## Working files (in `.issues/star-dict-featured-entries/`)

- `harvest.json` — per-dict candidate pools (both/photo_only/audio_only, pre-cleaned/ranked,
  capped at 20/15/30 respectively). Source of truth for entry_id lookups by index.
- `analyze-audio.mjs` — bulk ffprobe/ffmpeg volumedetect scorer for the 79 audio-only dicts.
  Already run → `audio-only-picks.json`.
- `make-contact-sheet.mjs <batch-name> <dict-id...>` — builds + screenshots an HTML contact
  sheet (top ~12 candidates/dict) for vision review → `contact-sheets/<batch-name>.png`.
- `make-contact-sheet-range.mjs <batch-name> <dict-id>:<start>-<end> ...` — same but for a
  specific index range (used when the first 12 don't yield 6 good ones and I need to look at
  13-20).
- `photo-picks.json` — running list of `{ id, name, tier, chosen: [{entry_id, lexeme, gloss}] }`
  for photo-tier dicts as I review each contact-sheet batch (best-first order in `chosen`).
- `insert-stars.mjs` (TODO) — reads `audio-only-picks.json` + `photo-picks.json` + a skip list,
  writes the actual `featured_entries` rows on the VPS.

## Batches (89 photo-tier dicts, ordered by entry_count desc, chunks of 6)

- [x] batch01: shauki, gutob, hazaragi, kihunde, nukuoro, gta — all 6 picked
- [x] batch02: batsi-kop-tsotsil-tsot (all 3 "both" candidates were bad clipart-style Maya
      glyph icons → fell back to its audio-only pool instead, 3 picks), apatani, matukar,
      werikyana, sengwer (all 6 picked each), wancho (SKIPPED — Wancho script renders as tofu
      boxes almost everywhere, the exact case the curate command calls out by name)
- [x] batch03: boienen-old-buhi-langua (both_partial, only 3 of 5 raw passed — kept 3), birhor
      (both_full but dict's photo corpus is 90% hand-drawn illustrations — only 5 real photos
      existed across all 20 candidates, kept 5), sibe/Manchu (both_full but EVERY "both"
      candidate was a b&w calligraphy glyph-on-white-paper image, same "boring/repetitive"
      call as Tsotsil → fell back to its audio-only pool, 3 picks), kapingamarangi (6, skipped
      4 candidates that were just islet location-pin map screenshots not real photos), kihehe
      (6), babanki (6)
- [x] batch04: owe (both_partial, only 1 candidate, kept it), san-sebastian-del-monte-m (6),
      olukumi (both_partial's lone candidate was clipart → fell back to its photo_only pool, 6
      picks), tutelo-saponi (both_partial's lone candidate was an unrelated boardroom photo →
      no photo_only pool at all → fell back to audio-only, 3 picks), garifuna (6, skipped 2
      literal solid-color-square placeholder "photos"), sora (6)
- [x] batch05: ishir-chamacoco (5), kalanga (both_partial had 2, one was a human-face portrait
      → kept 1), htanaw (SKIPPED — same tofu-box unrenderable-script issue as Wancho, checked
      its 61-strong photo_only fallback pool too and every lexeme there is equally unrenderable),
      chikunda (6), mahasuvi (both_full's 7 candidates were 6 near-identical plain tool-on-dirt
      photos + 1 real dog photo → kept just the 1 good one), mokilese (6)
- [x] batch06: northern-michif (both_full but dict leans heavily on stock/clipart imagery —
      only 4 real photos passed), pingelapese (5), haryanvi (5 candidates, 1 mismatched macro
      shot rejected → kept 4), angika (6), cinyungwe (6), yokoim (6)
- [x] batch07: mam (both_full but dict is 90% Mayan-numeral flashcards/portraits → kept only 1),
      shona (both_partial had 2, kept 1), eyak (6, all 9 raw candidates were great — easy
      batch), sepedi-living-dictionary (6, lots of clipart icons/shapes to skip, had to pull a
      6th from indices 12-19), iquito (6), panim (both_partial's lone candidate kept)
- [x] batch08: opata (both_partial lone candidate kept), jewish-neo-aramaic (4 candidates, 1
      flat color-swatch rejected → kept 3), sakapulteko (6, skipped several human body-part
      close-ups: mouth/eye/foot), kaqchikel (6, lots of body-part-closeups + a shaman
      portrait + clipart to skip, pulled a 6th from 12-19), qanjobal (6, skipped 3 more
      body-part close-ups: nose/ear/eye + a mismatched flat-color "moon"), chalchiteko (6,
      dict mixes real photos with clipart illustrations — stuck to the real photos)
- [x] batch09: louisiana-creole (photo_only lone candidate kept), kharia (6, skipped a
      cartoon-mouse illustration + a wedding-couple face photo), ese-ejja (6, excellent
      wildlife photo pool, easy batch), malapulaya (6, skipped a child's face + a medical
      tumor photo + a sick-person photo), taiengdictionary (3, all kept), jaRhn6MAZim4Blvr1iEv
      /Bahasa Lani (both_partial had 3, one was a pencil-sketch illustration → kept 2)
- [x] batch10: oron (both_full but heavy on digit-flashcard graphics → only 3 real photos),
      tiv (both_partial's all 3 candidates were human body-part close-ups — hair/ear/mouth,
      no photo_only pool either → fell back to audio-only, 3 picks), qeqchi (6, lots of
      body-part closeups + organ illustrations to skip, pulled a 6th from 12-19), arvanitika
      (both_full full of digit/question-mark graphics + a religious icon painting + a literal
      broken "Error: Server Error" image → only 3 in first 12, pulled 3 more from 12-19),
      poqomam (6, skipped more body-part closeups + an organ illustration + a child's face),
      johari (3, all kept)
- [x] batch11: kiche (both_partial had 5, 3 were solid-color ovals in a decorative clipart
      frame → kept 2), itza (both_full, lots of face/body-part/illustration rejects → kept 4),
      akateko (both_partial's all 3 candidates were human face portraits, no photo_only pool
      → fell back to audio-only, 3 picks), uspanteko (6), yanesha (6, great pool — easy batch),
      gaidhlig-uisge-dhearg (both_partial had 5, 3 were the same map-graphic style → kept 2)
- [x] batch12: san-francisco-yatee-zapo (both_partial lone candidate kept), tuun-javi-ixpantepec-ni
      (photo_only lone candidate kept), siriono (photo_only — entire photo corpus is vintage
      B&W bird-species engravings; judged these acceptable since they're detailed literal
      depictions of the actual animal, unlike Tsotsil's abstract glyphs/Manchu's calligraphy
      specimens which I'd rejected earlier — kept 6), wakhi (3, all kept), houma-uma (6,
      skipped a blank placeholder + a mismatched pumpkin-field photo captioned "snake" + 2
      human-face photos), badhani1 (photo_only lone candidate kept)
- [x] batch13: aewa (both_full, lots of clipart to skip, pulled a 6th monkey photo from
      12-19), zapoteco-de-la-sierra-n (6, great wildlife pool), south-african-gujarati (6,
      skipped a sleeping-baby face + a family portrait + a brain photo), woleaia (6, lots of
      real canoe/nautical-culture photos), lugbara (photo_only but dict leans heavily on
      portraits/illustrations/religious art → only 1 real qualifying photo, the waterfall),
      quechuaboliviano (both_full full of body-part closeups + a face portrait + a
      color-square + a broken/blank image → kept 4)
- [x] batch14: dompo (6, excellent all-real wildlife pool), movima (photo_only, all 6 kept —
      great pool incl. a very appealing sloth), tepehua-de-huehuetla (6, dict is mostly
      near-identical green-bush photos — picked the 6 with distinguishing color/flowers/fruit),
      balti (both_partial's lone candidate was 2 kids' faces → fell back to its 6-strong
      photo_only pool, but 4 of those were ALSO faces/mismatch → kept 2: snow + flowers),
      muthuvan (both_full's 12 candidates were ALL pink anatomical line-drawing illustrations
      of body parts → fell back all the way to audio-only, which only had 1 candidate total →
      kept that 1), chittagonian (photo_only lone candidate kept)
- [x] batch15: jaunsari1 (SKIPPED — same tofu-box unrenderable-script issue as Wancho/Htanaw,
      confirmed across its entire 3-candidate photo_only pool), bhojpuri (photo_only lone
      candidate was a clipart tree illustration, no audio_only fallback either → SKIPPED),
      atlas-vivo-de-mayunmarka (both_partial lone candidate, an adorable spectacled bear cub,
      kept), laz (photo_only lone candidate was an institute logo graphic → fell back to its
      2-strong audio-only pool, both passed the duration/volume check, kept both), ngaju
      (photo_only, all 3 kept)

## DONE — final results (2026-07-04)

Merged `photo-picks.json` (78 dicts) + `photo-tier-audio-fallback-picks.json` (7 dicts that
fell back all the way to audio-only after their photo pool vision-failed:
batsi-kop-tsotsil-tsot, sibe, tutelo-saponi, tiv, akateko, muthuvan, laz) +
`audio-only-picks.json` (79 dicts) → `combined-picks.json` (164 dicts, 601 stars), inserted via
`insert-stars.mjs` (migration-safe `CREATE TABLE IF NOT EXISTS` + fractional `sort_key` +
Jacob's user id) run on the VPS. Verified: 601/601 rows landed (0 errors), sort order and
media match expectations on spot-checks (shauki/remo/sibe/gta).

**Final tally across 221 public dictionaries:**
- 164 dictionaries got stars (601 entries total)
- 53 skipped — no photo or audio anywhere
- 4 more skipped despite having "both" candidates — all rejected on vision/quality grounds:
  **wancho** and **htanaw** and **jaunsari1** (unrenderable/tofu-box scripts — checked their
  full fallback pools too, same issue throughout) and **bhojpuri** (its one candidate was a
  clipart tree, no audio fallback existed)

Working files kept in this folder for reference/audit: `harvest.json` (raw candidate pools),
`photo-picks.json` / `photo-tier-audio-fallback-picks.json` / `audio-only-picks.json` (the
actual selections with reasoning captured in the batch notes above), `combined-picks.json`
(what was actually inserted), `insert-results.json` (per-dict insert counts), `contact-sheets/`
(every vision-review screenshot, in case Jacob wants to spot-check judgment calls).

### Notable judgment calls worth Jacob's attention
- **Recurring media types I rejected as "not real photos":** clipart/cartoon illustrations
  (very common — several dicts lean heavily on them), digit/number flashcards (Mayan numeral
  teaching dicts especially), literal solid-color squares/circles, map-location-pin graphics,
  organ/anatomy diagrams, 3D-rendered objects, broken/`Error: Server Error` images.
  Human faces/body-part closeups (hands, eyes, ears, noses, necks, knees) were rejected
  everywhere they appeared as a strict rule.
- **Script-rendering skips:** wancho, htanaw, jaunsari1 — lexemes render as tofu boxes in
  headless Chrome (same font-coverage issue the curate-featured-words command calls out for
  Wancho by name). Worth a follow-up check on whether this is fixable app-side (bundling a
  fallback webfont) vs. inherent to the scripts.
- **Judgment call on "illustration vs. legitimate script/art content":** rejected Tsotsil's
  Maya-glyph icons and Manchu's calligraphy-specimen photos as too monotonous/uninformative
  (fell back to audio-only for both), but *accepted* Sirionó's vintage bird-species engravings
  since they're detailed literal depictions of the actual animal (closer to a field-guide photo
  than a symbolic glyph). Reasonable people could draw this line differently — flagged in case
  Jacob wants to override either way during the real `/admin/featured-words` review.
- A handful of dicts (mahasuvi, mam, shona, lugbara, kalanga, opata, panim, etc.) only had 1-2
  real qualifying photos despite having a full 20-candidate "both" pool — their photo corpus is
  dominated by clipart/portraits/plant-macro-repeats with only a couple of standouts.

### Next step (not done — future work)
Run the real `curate-featured-words` command whenever Jacob wants to pull from this now-full
pile of editor stars into the shared homepage bucket (its Step 2 "sweep editor stars" will pick
these up automatically via the `starred_at` watermark).

## Remaining steps

1. Work through batch03-15 (contact sheet → vision review → append to `photo-picks.json`).
2. Merge `audio-only-picks.json` + `photo-picks.json` + Tsotsil's special-case pick into one
   final picks list; note the 53 skips + wancho skip explicitly.
3. Write + run `insert-stars.mjs` on the VPS (migration-safe, fractional sort_key, Jacob's
   user id).
4. Spot-check a few dicts' `/home` pages (or query `featured_entries` directly) to confirm.
5. Report summary to Jacob (counts, notable skips/judgment calls like Tsotsil/Wancho).
