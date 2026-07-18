# Text reader AUDIO experience (player + karaoke)

Build the human-facing audio half of the texts/sentences pipeline. The API read/write side
landed in session 23807d97 (commit de0ddff3); the reader page
`site/src/routes/[dictionaryId]/text/[textId]/+page.svelte` currently renders NO audio.

Test dict: wenshanhua, text `5134f095-7582-4ccf-8ed6-4326c32e94f2` (seeded at
`site/.data/dictionaries/wenshanhua.db` + catalog in `.data/shared.db`). One text-level audio row
(`af4f64cd-…`, speaker 郭钦泰安), 15 sentences each with `tokens.default`. NOTE: local seed
`audio.timings` is NULL (prod push not yet in the snapshot — verified the R2 snapshot on
2026-07-18 still lacks timings). So verification is via a hand-crafted fixture + unit tests +
svelte-look stories, NOT prod data.

## Data model recap
- `audio.timings` = `MediaTimings` = `Record<sentence_id, "offset,duration|offset,duration|…">`.
  Offsets are relative to the END of the previous timed token, chaining ACROSS sentences (text-level
  media is one continuous clip). Empty pipe part = untimed token (punctuation). Pipe entries align
  1:1 with that sentence's `tokens.default`.
- Text-level audio: `audio.text_id` set. Sentence-level: `audio.sentence_id` set.
- Speakers via `audio_speakers` junction → `speakers`.
- Reference unpack impl: `~/code/tutor/scripts/wenshanhua-ld/pull.mjs` `unpack_timing_string`.

## Build plan
1. ✅ `$lib/media/media-timings.ts` — pure util: `unpack_timing_string`, `build_text_timings`
   (chains cursor across ordered sentences → Map<sentence_id, {start_ms,end_ms,token_spans}>),
   `find_active_token`. Vitest colocated.
2. ✅ `TextAudioPlayer.svelte` (colocated in route folder) — sticky/compact player owning the
   `<audio>`; bindable `current_ms`/`playing`; exported `play_span`/`seek`/`toggle`; speaker
   attribution; graceful degrade on error (dev serves a short placeholder via `/api/dev-media`).
3. ✅ `KaraokeSentence.svelte` — renders `tokens.default` forms, highlights the active token when
   `is_active && current_ms ∈ span`; falls back to plain headword text when no tokens/timing.
4. ✅ Wire into `+page.svelte`: text audio → sticky player; per-sentence karaoke; tap sentence =
   seek+play its span (when audio+timing); pencil affordance keeps edit-panel access for editors;
   no-audio dicts keep original tap-to-open behavior. Sentence-level audio rows → small listen btn.
5. ✅ i18n keys (en.json only).
6. ✅ Stories (light+dark) + vitest; run test/tsc/lint/check.

## Decisions
- Util lives in NEW `$lib/media/` feature folder (task-sanctioned; groups timings + player state).
  Existing `$lib/utils/media-url.ts` stays put.
- Karaoke drives off `tokens.default` (spans align to it per schema); fall back to plain text.
- Player self-contained (owns audio el + bindable state + instance-exported methods) so stories
  need no runes-based controller.

## Verification (all done)
- `pnpm vitest run src/lib/media/` — 9 timings-unpack tests pass.
- `pnpm check` — 0 errors (46 warnings, none in new files).
- `pnpm eslint` on all new/changed files — clean.
- svelte-look stories light+dark: `KaraokeSentence` (PlainText / Highlighting / InactiveTimed),
  `TextAudioPlayer` (WithSpeaker / NoSpeaker).
- LIVE end-to-end (puppeteer, admin, port 3041): player + speaker + 1:21 duration + karaoke
  highlight advancing on play; 15 sentences; no page errors; light + dark.
  `/tmp/text-audio-loaded.png`, `/tmp/text-audio-playing.png`, `/tmp/text-audio-dark.png`.

## Dev fixture (local only — `.data` is gitignored, NOT committed)
- Injected SYNTHETIC uniform 280ms/token timings into `.data/dictionaries/wenshanhua.db`
  `audio.timings` (prod's real timings weren't in the R2 snapshot yet on 2026-07-18).
- Generated an 81s silent mp3 at the audio row's dev-media path so the player + karaoke run live.
- A future prod snapshot pull will overwrite these with real timings; nothing to undo.

## Real-data verification (another session, 2026-07-18)
- Refreshed `.data/dictionaries/wenshanhua.db` from the prod snapshot — now carries REAL timings
  for both texts (58 sentences) + real prod audio bytes placed at both dev-media storage paths.
- Puppeteer-played clip-1 text on :3042: real audio plays (1:52, 郭钦泰安), pause + scrub advance,
  translations render, zero page errors. Shots: `/tmp/ld-real-mark.png`, `/tmp/ld-karaoke-clip1.png`.
- NOTE: prod now has THREE texts (a 广南 oral-history text `b74acc68…` added after the earlier
  snapshot) — nothing to do here; just expect 3 texts after the next snapshot refresh.

## Do NOT commit. Task complete pending Jacob's review.
