# ld-align — forced alignment for Living Dictionaries

Slim LD-owned copy of tutor's alignment core (MMS_FA, chunked-emission + one global
`forced_align`). Two runtimes, one contract (`words: [{text, align_form}]` in,
`timestamped_words: [{text, start_ms, end_ms}]` out — `align_form` is a–z + apostrophe only;
all romanization happens in the SvelteKit server, see `site/src/lib/db/server/align/`):

- **Prod**: Modal app `ld-forced-aligner` (`src/ld_align/modal_app/align.py`, A10G,
  scale-to-zero). Deploy rarely — this app is deliberately dumb and stable:

      uv run --extra modal modal deploy src/ld_align/modal_app/align.py

  The SvelteKit server calls it when `MODAL_ALIGN_URL` is set.

- **Dev / any machine (CPU)**: `scripts/align_words.py`, stdin JSON → stdout JSON.
  The SvelteKit server spawns it when `MODAL_ALIGN_URL` is unset. First run
  downloads the ~1.2 GB MMS_FA checkpoint. Needs `ffmpeg` on PATH.

      uv sync --extra local   # one-time
      uv run --extra local scripts/align_words.py < request.json
