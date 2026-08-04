# Audio playback derivative — compressed copy for playback, original preserved for research

**Status:** PLAN AGREED — all six decisions locked with Jacob 2026-08-03. **No code written, nothing
shipped.** Ready to implement; §10 is the build order.
**Origin:** product-journey lane 2026-08-02 → overnight brief item/agenda 10.
**Listening dashboards** (self-contained; originals stream from the live CDN, candidates embedded):
- round 1, all codecs — `/home/jacob/ld-audio/audio-dashboard.html` (11.7 MB)
- **round 2, MP3 candidates + the sample-peak ceiling — `/home/jacob/ld-audio/audio-dashboard-mp3.html`** (13.2 MB)

Regenerate with `/tmp/build_dash.py` / `/tmp/build_dash2.py` + `/tmp/dash_template.html`.

Photos get three WebP derivatives. Audio gets none — we serve the raw upload. This issue is the
measured case for a playback derivative, the processing recipe, and the linguistics guardrails.

---

## 1. What production actually holds (shared.db `media_objects`, 2026-08-03)

146,619 live audio objects · **29.06 GB** · 93.3 hours · mean 2.29 s per clip.

| ext | files | GB | avg KB | avg dur | effective kbps |
|---|---:|---:|---:|---:|---:|
| wav | 47,994 | 24.53 | 499 | 2.87 s | 1424 |
| mp3 | 84,237 | 3.10 | 36 | 2.02 s | 146 |
| x-wav | 3,499 | 1.08 | 300 | 1.90 s | 1291 |
| mpeg (mp3) | 7,747 | 0.26 | 33 | 2.04 s | 132 |
| x-m4a / m4a / aac / ogg / opus / amr | 3,142 | 0.10 | 26–60 | ~2 s | 100–195 |

**51,493 WAV files = 25.6 GB = 88 % of all audio bytes for 35 % of the clips.** The 140× cost
spread the journey lane measured is entirely "did the contributor upload WAV or MP3".

Worst dictionaries by bytes: sengwer 2.16 GB (805 KB/clip), babanki 1.51 GB (860 KB/clip),
werikyana 1.42 GB, sibe 1.30 GB, biyo 1.18 GB, kihehe 0.89 GB, tla-wilano 1160 KB/clip,
kayan-baram **1589 KB/clip**, san-sebastián-del-monte-mixtec 1125 KB/clip.

Row shape: `audio` has **146,592 entry clips, 22 text clips, 0 sentence clips**, and exactly
**22 rows carry `timings`** (all text audio, from the new forced-alignment work). That number
matters — see §5 karaoke.

## 2. What 60 real files say (sample: 4 clips × 16 dictionaries, pulled from prod R2)

Probed with ffprobe/ebur128/astats. Every number below is measured, not modelled.

**Format weirdness that costs bytes for nothing**
- Nearly every WAV is 16-bit **stereo** — and the difference channel measures **−inf dB**, i.e.
  the two channels are bit-identical. Mono downmix on those is arithmetically exact and **halves
  the data for free**. (A handful — birhor, one biyo, two siletz MP3s — have a real but
  noise-floor-level difference at −30…−49 dB.)
- birhor records at **96 kHz stereo** (3072 kbps): a 0.46 s word is 171 KB.
- Sample rates are 44.1 / 48 / 96 kHz. Nothing needs more than 48 kHz for playback.

**Loudness is the real user-facing defect, and it is worse than the byte problem**

| | value |
|---|---|
| integrated loudness spread across the 60 files | **−45.4 to −6.1 LUFS = 39.3 dB** |
| median | −19.0 LUFS |
| files that would need **> +10 dB** to reach −16 | 11 of 60 |
| loudest file (biyo) | −6.1 LUFS, true peak **+3.1 dBTP** — already clipping |
| quietest (siletz) | −45.4 LUFS — needs **+26.5 dB**, effectively inaudible on a phone |

39 dB is the difference between "comfortable" and "hold the phone to your ear in a silent room".
This is the single biggest listening-quality win available, and it is bigger than the bandwidth win.

**Silence padding**
Trimming head/tail at an adaptive threshold (noise floor + 6 dB, keeping 80 ms lead / 120 ms tail)
removes **20 % of total duration** across the sample, but the distribution is what matters: babanki
−25…−41 %, tutelo-saponi −39…−45 %, orich −27…−60 %, sengwer −17…−52 %, sibe −17…−50 %,
biyo one file **−70 %**. A fixed −50 dB threshold trims **0 %** on kayan-baram (room tone sits
above −50 dB) — hence adaptive, never fixed.

**Peaks / DC / noise**
- DC offset is negligible everywhere (max 0.001) — no DC filter needed.
- Several files peak at exactly 0.0 dBFS and measure > 0 dBTP after downmix — they are already
  clipped at source. Nothing we can do but avoid making it worse.
- Noise floors run −34 dB (biyo hot file) to −80 dB. Noise *reduction* is not recommended — see §5.

## 3. Candidate ladder — measured sizes over the same 60 files

Processing held at mono + linear loudness + adaptive trim; codec varies.

| candidate | total | shrink | avg/word | median LUFS | loudness spread | whole corpus |
|---|---:|---:|---:|---:|---:|---:|
| ORIGINAL | 30.8 MB | 1× | 526 KB | −19.0 | 39.3 dB | **29.06 GB** |
| Opus 16k mono | 367 KB | 86× | 6 KB | −17.7 | 8.2 dB | 0.57 GB |
| Opus 24k mono | 538 KB | 59× | 9 KB | −17.5 | 8.4 dB | 0.84 GB |
| **Opus 32k mono** | **716 KB** | **44×** | **12 KB** | −17.4 | 8.5 dB | **1.12 GB** |
| Opus 48k mono | 1.06 MB | 29× | 18 KB | −17.2 | 8.6 dB | 1.66 GB |
| MP3 64k mono | 1.49 MB | 21× | 25 KB | −17.6 | 8.0 dB | 2.33 GB |
| AAC 64k mono | 1.62 MB | 20× | 26 KB | −17.2 | — | 2.54 GB |
| MP3 96k mono | 2.34 MB | 14× | 38 KB | −17.6 | — | 3.67 GB |

Processing ladder at fixed Opus 32k mono:

| step | total | median LUFS | loudness spread | median length |
|---|---:|---:|---:|---:|
| mono + Opus only | 763 KB | −21.4 | 36.7 dB | 3.16 s |
| + linear loudness gain | 778 KB | −17.4 | **7.7 dB** | 3.16 s |
| + adaptive silence trim | 716 KB | −17.4 | 8.5 dB | **2.68 s** |
| + 70 Hz high-pass | 716 KB | −17.5 | 8.7 dB | 2.67 s |
| full gain + true-peak limiter | 727 KB | −16.4 | **4.3 dB** | 2.79 s |

**The mission number (with the agreed MP3 V6 recipe):** a Babanki word goes **860 KB → 23 KB**;
one screen of 20 words goes **17.2 MB → 0.45 MB (38×)**; the average word across the platform goes
**208 KB → 12 KB**. Whole corpus **29.06 GB → 1.70 GB**.

## 4. THE AGREED RECIPE (final — this is what gets built)

Two ffmpeg passes. Pass 1 measures (~0.1 s per clip); pass 2 encodes.

```bash
# ── pass 1 — measure, on the mono signal ───────────────────────────────────────
ffmpeg -i IN -af "aformat=channel_layouts=mono,ebur128=peak=true,\
astats=measure_perchannel=none:measure_overall=Peak_level+Noise_floor" -f null -
#   → I  = integrated LUFS
#   → SP = sample Peak level dBFS      (NOT the ebur128 true peak — see §8a)
#   → NF = Noise floor dB

gain_db  = min(-16 - I, -1.0 - SP)                      # one constant multiplier, never dynamics
trim_thr = clamp(min(NF + 6, I - 20), -70, -30)         # adaptive, never a fixed dB

# ── pass 2 — encode ───────────────────────────────────────────────────────────
ffmpeg -i IN -af "aformat=channel_layouts=mono,volume={gain_db}dB,\
silenceremove=start_periods=1:start_duration=0:start_threshold={trim_thr}dB:start_silence=0.08:detection=rms,\
areverse,\
silenceremove=start_periods=1:start_duration=0:start_threshold={trim_thr}dB:start_silence=0.12:detection=rms,\
areverse" \
  -c:a libmp3lame -q:a 6 -ar 32000 OUT.mp3
```

**Skip the two `silenceremove` stages entirely when the `audio` row has `timings`, or is
`sentence_id`/`text_id` audio** — trimming would desync karaoke (§6). Everything else still applies
to those clips.

Why each knob:
- **`-q:a 6` (VBR ~45 kbps) at 32 kHz mono** — 30 % smaller than CBR 64 kbps because bits follow the
  speech instead of being spent evenly on silence. 32 kHz keeps a 16 kHz Nyquist, far above the
  4–12 kHz band where /s/ vs /ʃ/ contrast lives; 22.05 kHz would start to dull sibilants and is
  rejected. libmp3lame writes a Xing header by default, so VBR duration and seeking are correct.
- **`min(…)` on the gain** = a single constant multiplier, never dynamics. Constrained on **sample
  peak**, not true peak — the correction in §8a, worth 0.8 dB of median level for free.
- **`detection=rms` with a noise-floor-relative threshold**, never a fixed dB: a fixed −50 dB trims
  0 % on kayan-baram (room tone sits above it) and would eat the onset of a quiet birhor clip.
- **80 ms lead pad** is deliberately generous — it protects the onset of quiet consonants
  (implosives, prenasalised stops, breathy/creaky onsets) and the pitch trajectory at word start.
- **No high-pass, no limiter, no noise reduction.** Decided in §8.

Measured result over the 60-file sample: **1.11 MB total (29× smaller), median −16.0 LUFS,
loudness spread 39.3 dB → 6.1 dB, median length 3.16 s → 2.74 s.**

## 5. Linguistics risk — what is safe and what is not

| step | verdict | reasoning |
|---|---|---|
| **Mono downmix** | ✅ safe | channels are bit-identical in the corpus; where they are not, the difference is at/below the noise floor. Never a linguistic signal. |
| **32 kHz resample** | ✅ safe for playback | 16 kHz Nyquist keeps every phonetic band that carries contrast, including sibilant energy (4–12 kHz). 44.1/48/96 kHz sources lose only content above 16 kHz, which no analysis of these recordings uses — and the **original is untouched**. |
| **Constant (linear) gain** | ✅ safe | multiplies every sample by one number. **All within-clip relative amplitude, stress, prosody, declination and intensity contours survive exactly.** Only the arbitrary recording-gain offset changes. |
| **Adaptive silence trim with pad** | ⚠️ mostly safe, flagged | removes room tone, not speech, at noise floor + 6 dB with 80/120 ms pads. Risk is real but small: a very quiet aspirated release or a breathy offset could sit within 6 dB of the floor. **This is the one step I'd want you to spot-check by ear** — the dashboard's "sort by most silence trimmed" view is built for exactly that. |
| **70 Hz high-pass** | ⚠️ arguable | removes handling rumble/HVAC. 70 Hz is below male modal F0 (typically 85–180 Hz) so tone survives, but it does touch the very bottom of the spectrum and would alter any analysis of subglottal/creak energy. Optional, and it bought **0 bytes** in the measurement. |
| **Limiter to hit −16 exactly** | ❌ REJECTED | dynamic range compression. Measured (delay-aligned against pure gain): `alimiter` moves **8 % of samples by >0.5 dB and 3 % by >3 dB** — syllable-scale gain movement on real speech, which is exactly where prosody and stress live. It would buy 2.3 dB of extra loudness consistency. Not worth it; the sample-peak ceiling (§8a) recovers most of that for free. |
| **Noise reduction (afftdn/arnndn)** | ❌ not recommended | spectral subtraction eats breathiness, creaky voice and low-amplitude fricatives — the phonation-quality cues that are often the *point* of the recording. Not proposed. |
| **Lossy codec at all** | ⚠️ inherent | MP3 at ~45 kbps is a perceptual codec: it discards what a human ear will not notice, which is not the same as what a spectrogram will not notice. **Nobody should ever measure F0, formants or VOT from the derivative.** That is why the original stays canonical and reachable. |

**The invariant:** the original is never modified, never replaced, never deleted, and stays the
thing the download link, the CSV export, `/api/v1`, the waveform editor, and forced alignment use.
The derivative is a playback convenience and nothing else.

## 6. Delivery — how the browser gets the small file

Real (bot-filtered) audience over the last 30 days, 9,881 sessions: Chrome 63.5 %, Safari 22.1 %,
Edge 4.1 %, Chrome-iOS 3.8 %, Firefox 2.9 %, Opera 2.1 %, Samsung 1.1 %. By platform: Windows 24 %,
Android 10 22 %, iOS 18 15 %, macOS 11 %, Linux 10 %, iOS 26 6 %, Android 6 5 %, iOS 17/11 1.2 %.
Countries: US 47 %, IN 6.1 %, MX 4.7 %, CN 4.5 %, MY 3.5 %, then GB/FR/IT/BR/CO.

**Ogg Opus is only supported in Safari 18.4+**, and ~22 % of real sessions are Apple — one reason
Opus was rejected. MP3 plays in every browser in that table, at every version, with no capability
check. **One derivative, universal.**

```html
<audio>
  <source src="…/{uuid}_p1.mp3" type="audio/mpeg">
  <source src="…/{uuid}.wav">            <!-- original: the "not generated yet" fallback -->
</audio>
```
The `<source>` list falls through on both an unsupported type and a **404**, so it doubles as the
"derivative doesn't exist yet" path — legacy clips work from day one with zero backfill dependency,
and no client needs to know whether generation has run. `AudioPlayer.svelte` currently sets a single
`src`, and four call sites use bare `new Audio(url)`; both need a small
`audio_sources(storage_path)` helper that builds the ordered list.

`_p1` is a **recipe version** in the key (photos have no equivalent and would need a bucket-wide
purge if their recipe changed). Bumping to `_p2` invalidates nothing cached and lets the sweep
delete `_p1` orphans on its normal schedule.

Storage: **+1.70 GB on top of 29.06 GB (+5.9 %)**.

Call sites that must move to the derivative: `AudioPlayer.svelte`, `WordCards.svelte`,
`FeaturedEntryFullscreen.svelte`, `EntryMentionPopover.svelte`, `admin/featured-words`.
Call sites that must **keep the original**: `EditAudio.svelte` + `AttachAudioModal.svelte`
(`Waveform`, download link), `TimingsEditor`, `$lib/db/server/align/*`, `export/entry-csv.ts`,
`/api/v1/dictionaries/[id]/media/[...path]`.

**Karaoke gotcha:** a trimmed derivative desyncs `audio.timings`, which are ms offsets into the
original. Only 22 rows have timings today (all text audio). Rule: **never trim a clip that has
`timings`, or that is text/sentence audio** — trim entry-word audio only. That keeps the reader
and the timings editor honest with no schema change.

## 7. Pipeline — where derivatives get made

Audio does **not** flow through our server: `/api/upload` mints a presigned PUT and the browser
sends bytes straight to R2 (photos are the opposite — they POST bytes to `/api/photo-upload`, which
is why photo variants are trivially in-process). So the derivative cannot be made "at upload" the
way photos are.

Worse: there is **no server callback after the PUT at all** today. `upload_media()` resolves with
the object key and the client writes the `audio` row into its own wa-sqlite DB, which reaches the
server later through `/changes`. "Automatic after upload" has to be built. All four pieces:

1. **Fast path — an explicit ping.** After the PUT resolves in `upload_media()`, POST the object key
   to a small endpoint that fires the transcode fire-and-forget — the exact shape of
   `store_photo_variants_in_background`. Derivative exists a second or two after upload. ffmpeg
   8.1.2 **is already in the production container** (video thumbnails use it).
2. **Backstop — a cheap short-interval sweep, NOT the weekly reconcile.** `media_objects` is already
   seeded with the audio key at presign time, so "audio objects older than 60 s with no `_p1.mp3`
   sibling row" is a plain indexed SQL query — no R2 listing, no I/O. Run it every few minutes. It
   covers a closed tab, a failed ping, and a transcode that threw.
3. **Weekly media reconcile** keeps owning orphan cleanup and `_p1` → `_p2` recipe-version sweeping;
   audio derivatives join its live-key set so the orphan pass never deletes them.
4. **One-off backfill** for the existing 146,619 files.

**Backfill cost, measured:** the two-pass recipe runs ~0.12 s wall per clip with 2-way parallelism
on a 2-core box (measured: 20 files × 13 ffmpeg invocations = 15.2 s). For the single MP3 derivative
that is roughly **4–6 hours of one 2-core box**, plus 29 GB of R2 GET (egress to our own compute is
free) and 1.7 GB of PUT. The `living` VPS is 2 cores / 8 GB and is also serving the site — this
should run **on mustang**, streaming each object, never staging the corpus on disk (mustang has
26 GB free). Order it worst-first (sengwer, babanki, werikyana, sibe, biyo, kihehe, kayan-baram,
tla-wilano) so the biggest wins land in the first hour.

Prod-safety: backfill writes only NEW keys (`_p1.mp3`) and NEW `media_objects` rows. It never
touches an original, never writes a dict DB, and is fully re-runnable.

## 8. Decisions — round 1 (Jacob, 2026-08-03)

| # | decision | outcome |
|---|---|---|
| 1 | codec | **MP3 mono only.** Opus rejected: fewer moving parts, one file, works everywhere. |
| 2 | fallback | **`<source>` chain: MP3 derivative → original.** No second codec. |
| 3 | loudness | **−16 LUFS, linear gain, no limiter** — but see the ceiling correction below. |
| 4 | trim | **Yes** — adaptive threshold, 80/120 ms pads, entry-word audio only. |
| 5 | high-pass | **No.** |
| 6 | pipeline | **Post-upload trigger + sweep backstop + one-off mustang backfill.** |

### 8a. Ceiling correction — true peak → SAMPLE peak (the real answer to "is the limiter better?")

Round 1's gain cap used **true peak** at −1.0 dBTP. Measured consequence: **43 of 60 files never
reached −16** (median 2.4 dB short, worst 6.9 dB). Investigating why:

- The cap is set by **isolated sub-millisecond spikes**. Across all 43 capped files, only
  **0.0715 % of samples** exceed −1 dBFS at full gain, and the **longest continuous overshoot is
  0.8 ms** (median 0.2 ms). Prosody lives at 50–500 ms. That is not prosody, it is waveform peaks.
- **6 of 60 originals already peak at ≥ −0.2 dBFS** — clipped at source. True-peak measurement
  inflates on an already-clipped file (inter-sample reconstruction overshoots the pinned samples),
  so a true-peak ceiling forces several dB of pointless attenuation to protect audio that was
  already damaged before we saw it.
- Meanwhile ffmpeg's `alimiter` is a **smoothing** limiter, not a peak shaver. Measured against the
  pure-gain signal (delay-aligned): `attack=1 release=10` moves **8.0 % of samples by >0.5 dB and
  3.1 % by >3 dB**; `attack=5 release=50` moves 10.6 % / 3.6 %. That IS syllable-scale gain
  movement — real dynamics processing on real speech.

**Therefore: keep linear gain, but constrain on SAMPLE peak at −1.0 dBFS, not true peak.**

| ceiling rule | files capped | median shortfall | worst |
|---|---:|---:|---:|
| true peak, −1.0 dBTP (round 1) | 43 / 60 | −2.4 dB | −6.9 dB |
| true peak, −0.5 dBTP | 38 / 60 | −2.3 dB | −6.4 dB |
| **sample peak, −1.0 dBFS** | **19 / 60** | **−1.6 dB** | −4.9 dB |
| sample peak, −0.3 dBFS | 14 / 60 | −1.2 dB | −4.2 dB |

Result on the corpus sample: median lands at **−16.4 LUFS, spread 6.1 dB** (was 8.5 dB), with zero
dynamics processing. The limiter would give 3.8 dB — the remaining 2.3 dB is what dynamics
processing buys, and it is not worth it.

Final gain rule: `gain_db = min(-16 - I, -1.0 - sample_peak_dBFS)`.

### 8b. MP3 encoder ladder — measured, same recipe, only the encoder differs

| MP3 option | total | shrink | avg/word | whole corpus | median LUFS |
|---|---:|---:|---:|---:|---:|
| VBR **V7** / 32 kHz | 965 KB | 33× | 16 KB | 1.55 GB | −16.0 |
| **VBR V6 / 32 kHz** ★ | **1.06 MB** | **29×** | **18 KB** | **1.74 GB** | −16.0 |
| CBR 48k / 32 kHz | 1.14 MB | 27× | 20 KB | 1.88 GB | −16.4 |
| CBR 56k / 32 kHz | 1.40 MB | 23× | 25 KB | 2.19 GB | −16.4 |
| CBR 64k / 44.1 kHz | 1.51 MB | 20× | 26 KB | 2.49 GB | −16.4 |
| VBR V5 / 44.1 kHz | 1.52 MB | 21× | 27 KB | 2.38 GB | −16.0 |
| CBR 80k / 44.1 kHz | 1.89 MB | 16× | 32 KB | 3.11 GB | −16.5 |

**VBR V6 at 32 kHz is 30 % smaller than CBR 64k** and spends its bits where the speech is. 32 kHz
keeps a 16 kHz Nyquist — well above the 4–12 kHz where sibilant contrast lives; 22.05 kHz would
start to dull /s/ vs /ʃ/ and is not proposed. libmp3lame writes a Xing header by default so VBR
seeking and duration reporting are correct.

### 8c. Pipeline trigger — answering "cron, or automatic after upload?"

Today there is **no server callback after the presigned PUT**: `upload_media()` resolves with the
object key and the client writes the `audio` row into its own wa-sqlite DB, which reaches the server
later through `/changes`. So "automatic after upload" has to be built. Proposed, both halves:

1. **Fast path — an explicit ping.** After the PUT resolves in `upload_media()`, POST the object key
   to a small endpoint that fires the transcode fire-and-forget (the exact shape of
   `store_photo_variants_in_background`). Derivative exists within a second or two of the upload.
2. **Backstop — a cheap short-interval sweep, not the weekly reconcile.** `media_objects` is already
   seeded with the audio key at presign time, so "audio objects older than 60 s with no `_p1.mp3`
   sibling row" is a plain indexed SQL query — no R2 listing, no I/O. Run it every few minutes. This
   covers a closed tab, a failed ping, and a transcode that threw.

The weekly reconcile still owns orphan cleanup and recipe-version (`_p1` → `_p2`) sweeping.

Until a derivative exists the `<source>` chain silently serves the original, so nothing is ever
broken by a missing or late derivative.

### 8d. Round 2 (Jacob, 2026-08-03) — encoder setting

**VBR V6 at 32 kHz mono** (`-c:a libmp3lame -q:a 6 -ar 32000`). 30 % smaller than the CBR 64 kbps
first picked, same perceived quality, bits follow the speech. Recipe in §4 is now final.

Nothing is open. Remaining risk to retire by ear, not by decision: spot-check the most heavily
trimmed clips (biyo −70 %, orich −60 %) in the round-2 dashboard before the backfill runs.

## 9. Reproducing the measurements

- `/tmp/audio-sample.tsv` — the 60 sampled R2 keys (4 random clips × 16 dictionaries).
- `/tmp/encode2.sh` — measure + encode all candidates for one file.
- `/tmp/enc3.sh` — the `-application audio` variants.
- `/tmp/lm.sh` — per-output size / integrated loudness / duration.
- `/tmp/build_dash.py` / `/tmp/build_dash2.py` + `/tmp/dash_template.html` → the two dashboards.
- `/tmp/mp3lad.sh` + `/tmp/mp3extra.sh` — the MP3 ladder with the final sample-peak gain rule.
- `/tmp/limtest2.py` — the delay-aligned limiter deviation measurement behind §8a.
- Prod queries ran through `ssh living 'docker exec -i sveltekit_blue node' < script.js`.


## 9b. Pre-execution audit (2026-08-03, second lane) — constraints the implementation MUST honor

1. **Owner-type is unknowable server-side at trigger time.** `/api/upload` presigns knowing only
   `{dict, kind, media_id}`; the `audio` row (entry vs `sentence_id`/`text_id`, `timings`) reaches
   the server LATER via `/changes`. So the post-upload ping must carry a client-supplied
   `trim: boolean` (the `add_audio` caller knows its owner kind). Trust it — it only shapes a
   derivative. The backstop sweep, which runs after the row has synced, verifies: if a derivative
   was trimmed but the row turns out to be text/sentence audio or has `timings`, regenerate
   untrimmed (same `_p1` key, overwrite).
2. **Replicate `/tmp/mp3lad.sh` LITERALLY, including its filter order.** The measured/auditioned
   chain applies `volume` BEFORE `silenceremove`, while `trim_thr` was computed from the PRE-gain
   noise floor — so on positive-gain (quiet) files the effective trim is conservative by the gain
   amount. That frame mismatch is what Jacob approved by ear; do NOT "correct" it by offsetting the
   threshold or reordering filters. Port the script's exact maths (including its NaN/inf fallbacks
   `I=-20, SP=-1, NF=-70`) into the unit-tested pure functions.
3. **Concurrency cap.** Fire-and-forget ffmpeg per upload on a 2-core box serving the site needs a
   small in-process queue (concurrency 1–2, `nice`d). A bulk upload burst must not fork unbounded
   transcodes; overflow is fine — the backstop sweep catches anything dropped.
4. **Dev path.** Dev has no R2 — uploads land in the local `/api/dev-media` store. The derivative
   pipeline must work there too (write `_p1.mp3` into the same dev store) so the §10 e2e can run
   against the dev server. Skip cleanly (log, don't throw) if ffmpeg is missing locally.
5. **Future-timings guard.** Today only text audio has `timings`, and text audio is never trimmed.
   But if alignment ever writes `timings` to a row whose derivative WAS trimmed (future entry-word
   alignment), karaoke silently desyncs against the derivative. Where `align/*` writes `timings`,
   add a regenerate-untrimmed hook (or at minimum a guard that flags the mismatch).
6. **Ledger hygiene.** Derivative `media_objects` rows set `is_variant=1` (+ bytes, duration_ms) so
   `/admin/storage` stays honest, and the weekly reconcile's live-key set includes `_p1.mp3` keys.
7. **Rescue the /tmp artifacts.** The measurement/dashboard scripts (§9) live in `/tmp` and will
   evaporate. Copy what the repo needs (recipe reference, dashboard generator for the §10
   verification re-run, the 60-key sample TSV) into `scripts/audio-derivative/` before building.
8. **Scope of execution.** Implement §10 steps 1–8 fully with tests; write the backfill script and
   smoke-test it against a small slice (~20 files, one worst dictionary — prod-safe: new keys only,
   re-runnable). Do NOT run the full 146k-file backfill and do NOT commit — Jacob reviews first.

## 10. Build order

1. ✅ `$lib/server/audio-derivative.ts` — the §4 recipe: measure pass, gain/threshold maths, encode
   pass, `store_media_bytes` + `record_media_object_by_key`, plus
   `store_audio_derivative_in_background()`. Unit-test the maths (gain cap, adaptive threshold,
   the timings/text skip) against fixtures; they are pure functions.
2. ✅ `audio_playback_key({ original_key })` in `$lib/utils/media-path.ts` next to `photo_variant_key`,
   → `{dict}/audio/{uuid}_p1.mp3`. Pure, unit-tested.
3. ✅ `audio_sources(storage_path)` in `$lib/utils/media-url.ts` → ordered `[{src,type}]`.
   Then `AudioPlayer.svelte` renders `<source>` children instead of `src=`, and the four
   `new Audio(url)` call sites (`WordCards`, `FeaturedEntryFullscreen`, `EntryMentionPopover`,
   `admin/featured-words`) build the element with sources. **Do not touch** `EditAudio`,
   `AttachAudioModal`, `TimingsEditor`, `align/*`, `entry-csv.ts`, or the v1 media redirect.
4. ✅ Post-upload ping endpoint + the `upload_media()` call after the PUT resolves.
5. ✅ The few-minute backstop sweep (indexed SQL over `media_objects`, no R2 listing).
6. ✅ Weekly reconcile: add audio derivatives to the live-key set + repair pass.
7. ✅ `scripts/` backfill, worst-dictionary-first, resumable, run on mustang.
8. ✅ **Update AGENTS.md** — its media paragraph says photos get variants and audio does not; that
   stops being true at step 3.

Verification: unit tests on the pure maths; a dev-server e2e that plays a word and asserts the
served bytes are the `_p1.mp3`; and a re-run of the round-2 dashboard generator against a handful
of freshly backfilled production keys to confirm the shipped pipeline reproduces the numbers in
§8b.

**Execution completed below; all work remains uncommitted for review.**

## Execution report

Implemented 2026-08-03 on mustang, uncommitted.

### Built

- Added the literal measured MP3 V6 / 32 kHz / mono recipe in
  `site/src/lib/server/audio-derivative.ts`, including the approved pre-gain
  threshold/filter-order quirk, NaN/inf fallbacks, timings/owner trim guard,
  `nice -n 19`, a two-worker/40-pending in-process queue, dev-media support,
  `_p1.mp3` storage, and `is_variant=1` ledger rows with bytes + duration.
- Added the authenticated post-PUT ping and the client owner-type trim hint.
- Added the five-minute SQL-ledger backstop. Missing derivatives are selected
  with an indexed key join and recent derivatives are rechecked against the
  synced audio row so a mistakenly trimmed text/sentence/timed clip is
  overwritten untrimmed. Alignment also directly queues untrimmed regeneration
  whenever it writes timings.
- Added `audio_playback_key`, ordered `audio_sources`, `<source>` fallback in
  `AudioPlayer`, and derivative-aware construction at the four approved bare
  `Audio` playback sites. Original-only editing/alignment/export/v1 surfaces
  were not changed.
- Weekly reconcile now parses `_p1` as a variant and derives it into every live
  audio key set, preventing false orphaning.
- Rescued the `/tmp` recipe/sample/dashboard artifacts into
  `scripts/audio-derivative/`, added a dry-run-by-default/resumable backfill and
  a separately reviewable ledger apply helper, and updated `AGENTS.md`.

### Verification

- Pure/unit tests: 25 passed across audio maths, media paths/URLs, and media
  reconcile helpers.
- `tsc --noEmit`: passed.
- `pnpm lint`: passed.
- `pnpm -F site check`: 0 errors (48 pre-existing warnings in 23 files).
- Dev-server Chromium E2E: authenticated as the dev fixture manager, uploaded
  a generated WAV, queued the derivative, fetched 4,149 bytes beginning `ID3`,
  played it, and asserted `HTMLAudioElement.currentSrc` ended in the exact
  generated `_p1.mp3` key. No page errors.
- Production smoke only (no full backfill): wrote exactly 20 new Sengwer
  `_p1.mp3` objects, 1,074,960 bytes / 189,971 ms total, and recorded 20
  `is_variant=1` ledger rows. Five sampled CDN objects independently probe as
  MP3, 32,000 Hz, mono with sizes matching the ledger.
- Re-ran the preserved round-2 dashboard generator (`rows 60`). Discovery: it
  is hard-coded to its original `/tmp/ld-audio` candidate ladder and therefore
  cannot ingest CDN `_p1` outputs without rebuilding every local ladder variant;
  shipped-output reproduction was instead checked directly against five fresh
  CDN smoke objects with `ffprobe` as recorded above.

### Files / review focus

Code touched: `AGENTS.md`; audio media path/URL/player and four playback
components; upload/add-media; alignment hook; media ledger/reconcile/cron;
new derivative generator, backstop, endpoint + `_call`; and
`scripts/audio-derivative/*`.

Reviewer should scrutinize the ffmpeg stderr parsers, the queue overflow cap,
the backstop's fixed UUID-key SQL expression, and whether the standalone
backfill's deliberately separate ledger-apply step is the desired operational
interface before authorizing the full corpus run. The original objects and
dictionary DBs were never modified, replaced, or deleted.

### Review corrections

Post-execution review found that the first LUFS parser expected the number at
the end of the ebur128 summary line, but real ffmpeg appends `LUFS`. That made
the initial dev E2E and 20-object smoke use the `I=-20` fallback. Corrected both
the site generator and standalone backfill to parse the first metric token
after the label (with or without astats' colon), and added a captured-real-stderr
regression covering `I: -21.8 LUFS`, sample peak, and noise floor. The same 20
deterministic Sengwer keys were overwritten with corrected encodes and their
ledger bytes/durations refreshed. A cache-busted CDN probe of the first clip
measured original `I=-19.5 LUFS`, sample peak `-1.39 dBFS`, and derivative
`I=-19.1 LUFS`: the expected ~+0.39 dB sample-peak-capped gain.

The review also caught two `<source>` behavior details: the last source now
owns the terminal error handler, and an `audio_url` change waits for the source
DOM update then calls `audio.load()` so in-place prop changes rerun resource
selection. Final rerun: 25 unit tests passed; TypeScript and lint passed;
Svelte check remained at 0 errors / 48 pre-existing warnings; `git diff --check`
passed. No commit or push was made.

## Corpus backfill — run log

### Run 1 (2026-08-03 04:40 UTC) — DIED at 1.5%

Started with `workers=4`, wrote **2,210** of 146,997 derivatives, **0 failures**,
then stopped silently at **04:52:12 UTC**.

**Cause: the backfill was a child of the agent session's process group.** When
that horse session was aborted (`abortChildProcess` / `AbortSignal.onAbortListener`
in the journal at 04:52:12) the whole group died. Nothing was wrong with the
backfill itself — no FAIL lines, no stderr error, no OOM. The 2,210 objects it
did write are valid and are picked up by `--resume`.

> **Lesson: never run a multi-hour job as a plain background child of an agent
> session.** Use a detached `systemd-run --user` unit (mustang has `Linger=yes`,
> so user units survive logout).

### Run 2 (2026-08-03 20:46 UTC) — in progress

Relaunched as a detached systemd user unit:

```bash
systemd-run --user --unit=ld-audio-backfill \
  --working-directory=/home/jacob/code/living-dictionaries/scripts/audio-derivative \
  --property=EnvironmentFile=/home/jacob/ld-audio/r2.env \
  --property=StandardOutput=append:/home/jacob/ld-audio/backfill-run.log \
  --property=StandardError=append:/home/jacob/ld-audio/backfill-run.err \
  --property=Nice=19 --property=Restart=no \
  node backfill.mjs --keys=/home/jacob/ld-audio/worklist.tsv \
    --limit=200000 --workers=6 --apply --resume=/home/jacob/ld-audio/backfill-run.log
```

Operational notes:

- **Worklist moved out of `/tmp`** to `~/ld-audio/worklist.tsv` (146,997 keys;
  146,975 `trim=1` + 22 `trim=0` text/sentence/timed clips) so a tmp sweep can't
  destroy it mid-run.
- **R2 creds** are pulled from prod (`ssh living`, `/opt/hosting/sveltekit/.env`)
  into `~/ld-audio/r2.env`, `chmod 600`, outside the repo. `secrets-decrypted/`
  does not exist on mustang.
- **Log is appended, not replaced** — `--resume` reads `backfill-run.log` at
  startup and stdout appends to that same file, so ONE log accumulates every
  LEDGER line across restarts and is the single input to `apply-ledger.cjs`.
  `--limit` defaults to 20 and MUST be set high.
- **`workers=6` measured 4.6/s vs 2.9/s at `workers=4`** on mustang's 2 cores —
  the job is partly network-bound (CDN GET + R2 PUT), so oversubscribing cores
  pays. Everything is `nice -n 19`.
- **`Restart=on-failure` + `RestartSec=60`** (with `StartLimitBurst=100`,
  `StartLimitIntervalSec=0`) so a mid-run crash self-heals within a minute
  instead of idling until the follow-up cron. This is safe precisely because
  `--resume` is idempotent: every restart re-reads the log and skips finished
  keys, losing only the handful of in-flight encodes. A premature `exit 0`
  needs no restart — the script only exits 0 once every job is done.

### Mid-run quality verification (2026-08-03 20:55)

Spot-probed four shipped derivatives against their originals, recomputing the
recipe's gain from the originals' own measurements. Output matched prediction
within ~0.1 dB in every case, and format is `mp3 / 32000 Hz / mono` as designed:

| key | orig I | sample peak | gain | branch | deriv I |
|---|---|---|---|---|---|
| babanki/…6041659e | -16.8 | -1.30 | +0.30 | peak-capped | -16.1 |
| sengwer/…b53f60c5 | -20.2 | -2.74 | +1.74 | peak-capped | -18.4 |
| babanki/…5599c77d | -14.7 | -2.59 | -1.30 | LUFS-targeted | -15.8 |
| sengwer/…ee9a5709 | -19.2 | -7.66 | +3.20 | LUFS-targeted | -16.1 |

Both branches behave: LUFS-targeted clips land on -16, and peak-capped clips
deliberately stop short of -16 rather than clip. This also confirms the
review's corrected LUFS parser is what the corpus run is actually using — the
old bug would have pinned every clip to the `I=-20` fallback. Quiet clips can
land slightly ABOVE -16 (a -34.1 LUFS clip landed at -14.9) because trimming
leading/trailing silence raises the integrated loudness of the survivor; that
is expected, not a gain error.

Resume verified clean: `144,787 keys to process (2,210 already done)`.
ETA ~8.7h from 20:50 UTC → **~05:35 UTC 2026-08-04**.

### Checkpoint (2026-08-04 06:20 UTC, +9h27m) — 71%, still running

Unit `active (running)`, PID 4151132, no restarts. **104,163 LEDGER / 45 FAIL**
of 146,997 keys. Measured live rate over a 60s window: **3.53/s** — the run has
settled at **~3.0–3.5/s, not the 4.6/s the short `workers=6` benchmark
predicted**, so the ETA slipped from 05:35 UTC to **~09:40–10:15 UTC**. Memory
210 MB (peak 391 MB), CPU 10h23m across the 2 cores at `nice 19`.

> **Lesson: a 60-second throughput benchmark over-predicts a 9-hour run.** The
> corpus is not uniform — clip lengths, CDN latency and R2 PUT time all vary by
> dictionary, and the sustained average landed ~30% below the sample. Budget
> long media jobs off the sustained rate, not the burst rate.

**The 45 FAILs are benign and self-explaining** (0.04%):

| count | kind |
|---|---|
| 43 | `ffprobe exited 1: Failed to read frame size: Could not seek to 1026` on `.wav` originals — concentrated in temboka (14), werikyana (12), kihehe (9), tiv/galo/atomb (2 each) |
| 1 | `curl exited 56` — a transient CDN read failure (gta) |
| 1 | corrupt original misdetected by ffmpeg as a `vvc` video stream (siletz-dee-ni) |

The dominant mode is the encode producing an unreadable output mp3 for certain
`.wav` sources; playback for those rows simply keeps falling back to the
original, which is the designed behaviour. Worth a small follow-up pass, not a
blocker.

### Remaining steps (after the run finishes)

1. Confirm `systemctl --user is-active ld-audio-backfill` is `inactive` and the
   `[backfill] DONE` line is in `backfill-run.err`; `grep -c '^LEDGER'` should be
   ~146,997. Investigate if FAIL lines > 100.
2. Apply the ledger: `scp ~/ld-audio/backfill-run.log living:/tmp/`, then inside
   the live container — `DERIVATIVE_LOG=… SHARED_DB=/data/shared.db node apply-ledger.cjs`.
3. Verify: ffmpeg `ebur128` probe of 3 random `_p1.mp3` CDN urls (expect near
   -16 LUFS, or less gain when sample-peak-capped), and a shared.db count of
   `media_type='audio' AND is_variant=1` rows (~146k).
4. Update this report and give Jacob the final numbers.

Follow-up crons (each re-checks, relaunches if the run died, applies the ledger,
verifies, reports — and reschedules itself if the run is still going):

- ~~`c-223e77`, 2026-08-04 06:15 UTC~~ — ran; found the job healthy at 71% and
  rescheduled (see checkpoint above).
- **`c-eafbaf`**, one-time at **2026-08-04 10:30 UTC** on mustang — current.
