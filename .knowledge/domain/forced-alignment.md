# Forced alignment (auto-timings) — architecture decisions

M6 of the texts/sentences pipeline. Generates karaoke `audio.timings` for text/sentence audio
automatically instead of the dead tap-along flow. Code: `alignment/` (top-level uv package),
`site/src/lib/db/server/align/`, `site/src/lib/api/v1/align-route-handlers.ts`,
`site/src/lib/media/{AutoAlignButton.svelte,auto-align.ts}`,
`site/src/routes/admin/dictionaries/AlignConfigCell.svelte`. Full build log +
decisions: `.issues/auto-align-timings.md` (now in git history). This page holds only what the code doesn't say.

## The dumb-endpoint / smart-server split (the core design)

The **aligner is deliberately dumb and stable**: MMS_FA takes `words: [{text, align_form}]` where
`align_form` is a–z + apostrophe ONLY, and returns `timestamped_words`. It knows nothing about
scripts, dictionaries, or romanization. Jacob explicitly distrusts uroman's "handles any script"
claim for LD's exotic scripts, and Modal redeploys are slow — so **all romanization lives in the
LD SvelteKit server** (`align-forms.ts`), which iterates fast. The Modal app is expected to be
redeployed rarely (essentially never).

Two runtimes, one contract, chosen by `MODAL_ALIGN_URL` (`align-runner.ts`):
- **prod** → the LD-owned Modal app `ld-forced-aligner` (jacob-8 Modal account), a slim copy of
  tutor's forced-aligner. Gets a **public** audio URL (R2 media domain).
- **dev / any machine** → a local CPU subprocess of the SAME `alignment/` package
  (`uv run --extra local scripts/align_words.py`), fed a **local file path** from the dev-media
  store. So every dev machine can align with no GPU and no Modal — a real clip aligns in ~1.5s on
  CPU after model load, byte-identical to the GPU/Modal output. This is why there's no "dev fake
  aligner": the real thing runs locally.

Provenance: the Python is a copy of `~/code/tutor/alignment/src/align/{config,types,audio,
alignment/core}.py` + `modal_app/align.py`. Kept LD-owned so LD versions it independently; headers
in each file point back to tutor. Deploy with `modal deploy -m ld_align.modal_app.align` (MODULE
mode — script mode chokes on the package's relative imports).

## align_form derivation — why a per-token cascade, not one source

`dictionaries.align_config.primary` names the preferred source, but `derive_align_form` cascades
per-token: primary → the token's own surface form → any linked-entry lexeme value → entry
`phonetic`. A pure "pick one source" breaks on the first token that source can't cover; the
cascade + a coverage count (`tokens_aligned/tokens_total` + `gap_forms`) lets us report "94%
derivable" before running and leave the rest untimed rather than fail. `ascii_distill` does NFD +
strip-combining-marks so precomposed Latin diacritics survive as base letters, but non-Latin
letters (ɛ, ʂ, CJK) still drop — those dictionaries need either Latin material on their matched
entries or a bespoke converter.

**Converters (`converters.ts`) are the white-glove escape hatch.** Some scripts have letters that
don't sound like their a–z lookalikes; a per-dictionary converter (keyed by name in
`align_config.converter`) runs before `ascii_distill`. Jacob's explicit intent: this is one-off
spaghetti we keep on OUR side, NEVER shown to managers. Managers who are sophisticated run the
aligner themselves and push timings via the v1 API; managers who aren't get our hands-on help. So
`align_config` is admin-only — stripped from the client catalog row in `[dictionaryId]/
+layout.server.ts`, which exposes only `align_enabled`/`auto_align` presence booleans.

## Graduation, not automation-by-default

Trigger is a **manual manager-only button** at first (quality unproven per language). The per-dict
`align_config.auto_align` flag is the **graduation switch**: once we've watched a dictionary align
well and its community understands it, an admin flips the flag and audio attaches auto-align (no
confirm) via the same `run_auto_align` used by the button. There is deliberately no site-wide
"align everything automatically" mode.

## Job mechanics worth knowing

- `request_align_job` derives forms **synchronously** (cheap — the POST returns coverage numbers
  immediately) then fires the alignment **without awaiting**; the client polls `GET …/align-jobs/
  {id}` and the finished timings arrive through NORMAL dict sync (karaoke lights up on the next
  pull — the button calls `connection.sync_now()` to pull immediately).
- `align_jobs` (server-only shared.db, `source_files` pattern) doubles as the rate-limit ledger:
  today's rows count against per-dict (20) + global (200) daily caps.
- `build_media_timings` walks the flat aligner output back into per-sentence chained
  `MediaTimings` strings, clamping each span to `>= cursor` and `>= 20ms` (one CTC frame) so a
  slightly-out-of-order aligner result can't send the cross-sentence chain backwards.
- DEV GOTCHA (cost one e2e cycle): the local aligner subprocess runs with `cwd: alignment/`, so
  the dev-media audio path passed to it MUST be absolute (`resolve(dev_media_dir(), storage_path)`,
  not `join` — a relative `.data/...` resolves against the alignment dir → ffmpeg "No such file").

## Job lifecycle — why the deadlines are shaped this way (2026-07-25)

The first version had no bound on execution, so an interrupted process (deploy/restart) or a
backend that never settled left a `running` row that blocked every retry with HTTP 409 while the
browser polled forever. Hardening decisions worth keeping:

- **One meaning for `running` = "a live process owns this".** Enforced by a deadline chain in
  `$lib/constants.ts`: execution deadline (both backends abort) < stale bound (a `running` row
  older than this had no live owner and is swept to `failed`) < browser poll deadline (so the
  client always reaches a terminal state, then offers retry).
- **No boot sweep** even though "a fresh process owns nothing" is tempting: prod runs blue/green,
  two containers over one `/data`, so a booting standby must not fail the primary's live jobs.
  Age-based sweeping at request + status-poll time is uniformly safe and sufficient.
- **No `(audio_id, status)` index.** The daily caps (20/dict, 200/site) keep the table small and
  both queries are per-request, not hot-path — deliberately not paid for with client schema churn.
- The local subprocess is spawned **detached and killed by process group**: `uv run` → python means
  a plain `child.kill()` orphans the compute-heavy grandchild.
- A job that finishes AFTER being expired still writes `done` (the terminal UPDATE is by job id) —
  truthful, because the timings really did land.

## Deploy dependency

Prod needs `MODAL_ALIGN_URL` in `sveltekit-living.env` pointing at the deployed Modal endpoint.
Without it, prod falls back to the local runner, which the Docker image doesn't ship
(`alignment/` is in `.dockerignore`), so align attempts fail cleanly — harmless until a dictionary
has `align_config` set (the button is hidden otherwise).
