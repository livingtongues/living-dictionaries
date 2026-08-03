# Audio playback derivative — compressed copy for playback, original preserved for research

**Status:** PLANNING (measurement done, no code written, nothing shipped).
**Origin:** product-journey lane 2026-08-02 → overnight brief item/agenda 10.
**Listening dashboard:** `/home/jacob/ld-audio/audio-dashboard.html` (11.7 MB, self-contained;
originals stream from the live CDN, all candidates embedded). Regenerate with
`/tmp/build_dash.py` + `/tmp/dash_template.html` (scripts described at the bottom).

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

**The mission number:** a Babanki word goes **860 KB → 15 KB**; one screen of 20 words goes
**17.2 MB → 0.30 MB**. Whole corpus **29.06 GB → 1.12 GB**.

## 4. Recipe as measured (the exact ffmpeg the backfill would run)

Two passes. Pass 1 measures; pass 2 encodes. Pass 1 is ~0.1 s per clip.

```
# pass 1 — measure on the mono signal
ffmpeg -i IN -af "aformat=channel_layouts=mono,ebur128=peak=true,astats=measure_perchannel=none:measure_overall=Noise_floor" -f null -
   → I (integrated LUFS), Peak (true peak dBTP), Noise floor dB

gain_db   = min(-16 - I, -1.0 - true_peak)          # linear, never exceeds the peak ceiling
trim_thr  = clamp(min(noise_floor + 6, I - 20), -70, -30)

# pass 2 — encode
ffmpeg -i IN -af "aformat=channel_layouts=mono,volume={gain}dB,\
silenceremove=start_periods=1:start_duration=0:start_threshold={thr}dB:start_silence=0.08:detection=rms,\
areverse,silenceremove=…:start_silence=0.12:detection=rms,areverse" \
  -c:a libopus -b:a 32k -vbr on -application audio -ar 48000 OUT.opus
```

Why each knob:
- `min(…)` on the gain means a **single constant multiplier**, never dynamics. Cost: hot/clipped
  sources land at −17…−23 LUFS instead of −16, which is why the residual spread is 8.5 dB not 0.
- `detection=rms` + noise-floor-relative threshold, never a fixed dB, or kayan-baram trims nothing
  and a whisper-quiet birhor clip loses its onset.
- 80 ms lead pad is deliberately generous: it protects the onset of quiet consonants (implosives,
  prenasalised stops, breathy/creaky onsets) and the pitch trajectory at word start.
- `-application audio`, **not** `voip`: VoIP mode applies speech-specific processing that is exactly
  what you do not want on tone, creak, breath and ideophones. Same file size either way (measured
  736 KB vs 716 KB over 60 files) — so there is no reason to take the risk.

## 5. Linguistics risk — what is safe and what is not

| step | verdict | reasoning |
|---|---|---|
| **Mono downmix** | ✅ safe | channels are bit-identical in the corpus; where they are not, the difference is at/below the noise floor. Never a linguistic signal. |
| **48 kHz resample** | ✅ safe for playback | 24 kHz Nyquist keeps every phonetic band including fricative energy. (96 kHz sources lose ultrasonic content that no phonetic analysis of these recordings uses — and the **original is untouched**.) |
| **Constant (linear) gain** | ✅ safe | multiplies every sample by one number. **All within-clip relative amplitude, stress, prosody, declination and intensity contours survive exactly.** Only the arbitrary recording-gain offset changes. |
| **Adaptive silence trim with pad** | ⚠️ mostly safe, flagged | removes room tone, not speech, at noise floor + 6 dB with 80/120 ms pads. Risk is real but small: a very quiet aspirated release or a breathy offset could sit within 6 dB of the floor. **This is the one step I'd want you to spot-check by ear** — the dashboard's "sort by most silence trimmed" view is built for exactly that. |
| **70 Hz high-pass** | ⚠️ arguable | removes handling rumble/HVAC. 70 Hz is below male modal F0 (typically 85–180 Hz) so tone survives, but it does touch the very bottom of the spectrum and would alter any analysis of subglottal/creak energy. Optional, and it bought **0 bytes** in the measurement. |
| **True-peak limiter to hit −16 exactly** | ❌ scholarly-lossy | this is dynamic range compression. It changes relative amplitude *within* the clip — the exact thing prosody and stress live in. It halves the residual loudness spread (8.5 → 4.3 dB), which is a real listening win, so it is your call, but it is the one step I would not do silently. |
| **Noise reduction (afftdn/arnndn)** | ❌ not recommended | spectral subtraction eats breathiness, creaky voice and low-amplitude fricatives — the phonation-quality cues that are often the *point* of the recording. Not proposed. |
| **Lossy codec at all** | ⚠️ inherent | Opus at 32 kbps is a perceptual codec: it discards what a human ear will not notice, which is not the same as what a spectrogram will not notice. **Nobody should ever measure F0, formants or VOT from the derivative.** That is why the original stays canonical and reachable. |

**The invariant:** the original is never modified, never replaced, never deleted, and stays the
thing the download link, the CSV export, `/api/v1`, the waveform editor, and forced alignment use.
The derivative is a playback convenience and nothing else.

## 6. Delivery — how the browser gets the small file

Real (bot-filtered) audience over the last 30 days, 9,881 sessions: Chrome 63.5 %, Safari 22.1 %,
Edge 4.1 %, Chrome-iOS 3.8 %, Firefox 2.9 %, Opera 2.1 %, Samsung 1.1 %. By platform: Windows 24 %,
Android 10 22 %, iOS 18 15 %, macOS 11 %, Linux 10 %, iOS 26 6 %, Android 6 5 %, iOS 17/11 1.2 %.
Countries: US 47 %, IN 6.1 %, MX 4.7 %, CN 4.5 %, MY 3.5 %, then GB/FR/IT/BR/CO.

**Ogg Opus is only supported in Safari 18.4+.** ~22 % of real sessions are Apple, and a slice of
those predate 18.4. So a single Opus derivative would silence some iPhones.

Proposed: **two derivatives + native `<source>` fallback**, no JS capability sniffing, no schema
column:

```html
<audio>
  <source src="…/{uuid}_p1.opus" type="audio/ogg; codecs=opus">
  <source src="…/{uuid}_p1.mp3"  type="audio/mpeg">
  <source src="…/{uuid}.wav">            <!-- original: also the "not generated yet" fallback -->
</audio>
```
The `<source>` list falls through on **both** an unsupported type and a 404, so it doubles as the
"derivative doesn't exist yet" path — legacy clips work from day one with zero backfill, and no
client needs to know whether generation has run.

`_p1` is a **recipe version** in the key (photos have no equivalent and would need a bucket-wide
purge if their recipe changed). Bumping to `_p2` invalidates nothing cached and lets the sweep
delete `_p1` orphans on its normal schedule.

Combined storage: Opus 1.12 GB + MP3 2.33 GB = **3.45 GB on top of 29.06 GB (+12 %)**.

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

Three places it can happen, and I think we want all three:

1. **Post-upload trigger** — after the client's PUT succeeds it already calls back to record the
   row; that call fires a background job that GETs the object from R2, transcodes, PUTs both
   derivatives, and records them in `media_objects`. Same fire-and-forget shape as
   `store_photo_variants_in_background`. ffmpeg 8.1.2 **is already in the production container**
   (video thumbnails use it).
2. **Weekly media reconcile** — the existing sweep already "repairs missing derivatives" for
   photos; audio joins the same live-key set so a crashed job or a failed transcode self-heals, and
   `_p1` orphans get swept when the recipe version bumps.
3. **One-off backfill** for the existing 146,619 files.

**Backfill cost, measured:** the two-pass recipe runs ~0.12 s wall per clip with 2-way parallelism
on a 2-core box (measured: 20 files × 13 ffmpeg invocations = 15.2 s). For both derivatives that is
roughly **5–7 hours of one 2-core box**, plus 29 GB of R2 GET (egress to our own compute is free)
and ~3.5 GB of PUT. The `living` VPS is 2 cores / 8 GB and is also serving the site — this should
run **on mustang**, streaming each object, never staging the corpus on disk (mustang has 26 GB
free). Order it worst-first (sengwer, babanki, werikyana, sibe, biyo, kihehe, kayan-baram,
tla-wilano) so the biggest wins land in the first hour.

Prod-safety: backfill writes only NEW keys (`_p1.*`) and NEW `media_objects` rows. It never touches
an original, never writes a dict DB, and is fully re-runnable.

## 8. Open decisions (asked in chat, one at a time)

1. Codec + bitrate for the derivative → recommend **Opus 32 kbps mono, `-application audio`**, with
   an MP3 64 kbps mono companion for Safari < 18.4.
2. Loudness target and method → recommend **−16 LUFS via peak-capped linear gain** (no limiter).
3. Silence trim → recommend **yes, adaptive threshold, 80/120 ms pads, entry audio only**.
4. High-pass → recommend **no** (zero byte saving, non-zero scholarly cost).
5. Fallback strategy → recommend **dual derivative + `<source>` chain**.
6. Pipeline → recommend **post-upload background job + reconcile repair + one-off mustang backfill**.

## 9. Reproducing the measurements

- `/tmp/audio-sample.tsv` — the 60 sampled R2 keys (4 random clips × 16 dictionaries).
- `/tmp/encode2.sh` — measure + encode all candidates for one file.
- `/tmp/enc3.sh` — the `-application audio` variants.
- `/tmp/lm.sh` — per-output size / integrated loudness / duration.
- `/tmp/build_dash.py` + `/tmp/dash_template.html` → `/home/jacob/ld-audio/audio-dashboard.html`.
- Prod queries ran through `ssh living 'docker exec -i sveltekit_blue node' < script.js`.

**Nothing in this issue has been implemented. No repo files were changed.**
