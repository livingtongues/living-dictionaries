-- Texts & sentences pipeline (M1, .issues/texts-sentences-pipeline.md):
--
-- `sentences.tokens` — per-orthography tokenization + word→entry match state,
-- stored as ONE JSON column (not a per-word table: a 10k-word text would mean
-- 10k synced rows in every client's OPFS DB). Shape:
--   { [orthography_code]: [{ form, start, end, entry_id?, sense_id?, candidates?, status? }] }
-- Confirmed word→sense links are ALSO written to `senses_in_sentences` so
-- concordance queries stay relational.
--
-- `audio.timings` / `videos.timings` — compact per-sentence word timings for
-- karaoke playback (M5), keyed by sentence id:
--   { [sentence_id]: "offset,duration|offset,duration|" }
-- Pipe-delimited entries align 1:1 with that sentence's default-orthography
-- tokens; offset is relative to the end of the previous timed token (chainable
-- across sentences for text-level media); empty entry = untimed token (e.g.
-- punctuation). Format ported from tutor's parse-words/encode-word-timings.
ALTER TABLE sentences ADD COLUMN tokens TEXT;
ALTER TABLE audio ADD COLUMN timings TEXT;
ALTER TABLE videos ADD COLUMN timings TEXT;
