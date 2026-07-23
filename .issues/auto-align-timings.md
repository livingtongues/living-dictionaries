# Auto-align timings (M6 of the corpus pipeline) — forced alignment for text/sentence audio

Follow-up to M5 (waveform timings editor) in `.issues/texts-sentences-pipeline.md`. NOT started —
this file captures the 2026-07-23 interview decisions so planning can resume fresh. Interview
Jacob on the open questions before building.

## Decided (Jacob, 2026-07-23)

- **Model**: MMS_FA (Meta's multilingual forced aligner, same as tutor) — one model for all
  languages; vocab is 26 ASCII letters + apostrophe, so every token needs a romanized
  `align_form`.
- **Infra**: an **LD-owned Modal app**, a copy of tutor's `forced-aligner`
  (`~/code/tutor/alignment/src/align/modal_app/align.py` — A10G, memory snapshot, scale-to-zero,
  `POST { audio_url, words: [{ text, align_form }] } → { timestamped_words[{start_ms,end_ms}] }`).
  Modal's free $30/mo should cover it indefinitely.
- **The Modal app stays DUMB and stable** — agnostic input contract, redeployed rarely ("Modal
  doesn't iterate fast"). Jacob is skeptical of uroman's "handles any script" claim for LD's
  exotic scripts, so romanization does NOT live in Modal.
- **The LD server is the smart, fast-iterating layer**: it derives `align_form`s per dictionary
  and is the ONLY caller of Modal. Rate limiting lives here too (abuse surface is our server, not
  the endpoint).
- **align_form derivation strategies** (per dictionary, in rough order):
  1. Latin-ish orthography → distill to a-z' directly (lowercase, strip diacritics).
  2. A phonetic field that can be distilled to 26 chars.
  3. Latin material from the dictionary's matched entries (tokens are entry-linked after M3 —
     if entries carry any Latin form/phonetic, alignment can route through them).
  4. Nothing Latin exists → the community needs help establishing at least one Latin writing
     system. **This is a white-glove power-user feature; we expect to provide assistance
     per-dictionary**, not a fully self-serve automatic.
- **Trigger**: manual "Auto-align" button ONLY at first (quality unproven across languages).
  **Per-dictionary graduation switch**: once a dictionary is approved — we've seen it work and
  the community understands it — flip a flag and that dictionary aligns AUTOMATICALLY (on audio
  attach / text edit). Suggests a `dictionaries`-level (or settings) `auto_align` flag.
- Tap-along manual timing is dead; humans only adjust aligner output in the M5 waveform editor.

## Open questions for the planning interview

- Button permission: manager-only vs contributor+ (GPU cost, even if small)?
- Where the per-dict align config lives (strategy choice + approved/auto flag) — dictionary
  settings vs admin-only surface?
- Job shape: synchronous request (texts can be minutes of audio — Modal align of ~2min clip is
  seconds) vs queued with status row? What does the UI show while running?
- Audio URL handed to Modal: public GCS/serving URL vs presigned; dev-mode story (no GCS —
  `/api/dev-media` is localhost-only, Modal can't reach it).
- Rate limiting concretely: per-dict per-day counter in shared.db?
- Re-align semantics when a human has hand-adjusted timings (M5 editor) — warn before overwrite?
- v1 API parity: expose an align endpoint for agents too?

## Reference

- tutor's alignment knowledge: `~/code/tutor/.knowledge/architecture/alignment.md` (chunked
  emission windows for long audio, fp16-on-cuda, 20ms CTC frame floor).
- tutor align_form derivers: `~/code/tutor/site/src/lib/aligner/align-form.ts` (english,
  chinese/pinyin).
- Modal server-fallback design notes: `~/code/tutor/.issues/future/aligner-api-fallback.md`.
