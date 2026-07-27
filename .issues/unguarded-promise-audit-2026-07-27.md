# Unguarded-promise audit — where one uncaught promise gates a user-facing feature

**One-off sweep, 2026-07-27.** Ordered by the fleet after the same bug class surfaced independently
in all three repos on 2026-07-26 (LD's instance: `audio.play()` — four real visitors tapped play 3–7
times each and got silence, and the telemetry could not say why).

**Rule followed:** report, don't blind-fix. Trivially safe fixes applied and marked ✅ FIXED;
everything else is a recommendation with a severity.

## The pattern to look for

Not "an await without try/catch" — most of those are fine. The dangerous shape is:

> a promise whose rejection is **the only signal** that a visible feature didn't happen,
> and nobody is listening.

Two tells: (a) the UI keeps showing the optimistic state (a pause icon over silence), and (b) the
rejection lands in `client_logs` as a bare `unhandled_rejection` with no url, no error name, no
element state — unattributable, so it can never be diagnosed later.

## Findings

| # | Site | Severity | What a rejection costs | Status |
|---|---|---|---|---|
| 1 | `routes/[dictionaryId]/entries/components/Audio.svelte` (module `playAudio`) | **P1** | The entry/list play button does nothing, silently, forever. THE reported bug. | ✅ FIXED |
| 2 | `lib/media/AudioPlayer.svelte` ×2 (`toggle`, `play_span`) | P2 | Reader/sentence audio + karaoke span playback silently no-op. | ✅ FIXED |
| 3 | `lib/media/TimingsEditor.svelte` ×2 (span play, scrub play) | P2 | The timings editor's transport dies silently mid-edit. | ✅ FIXED |
| 4 | `lib/components/audio/Waveform.svelte` (`await audio.play()` in an async handler) | P2 | `playing` stays true over silence; unattributed rejection. | ✅ FIXED |
| 5 | `lib/utils/exclusive-audio.svelte.ts` | P2 | Card shows a pause icon with nothing playing (`onerror` never fires for a rejected `play()`). | ✅ FIXED |
| 6 | `lib/components/home-v2/WordCards.svelte` + `FeaturedEntryFullscreen.svelte` | P2 | Homepage word cards — the first thing a visitor touches. | ✅ FIXED |
| 7 | `routes/admin/featured-words/FeaturedWordsView.svelte` | P3 | Admin-only; same stuck-state shape. | ✅ FIXED |
| 8 | `lib/components/keyboards/keyman/Keyman.svelte:56` `load_keyman_writing_systems().then(…)` | **P2** | No catch: the Keyman writing-system list silently stays empty, so the on-screen keyboard offers nothing and the failure is an anonymous rejection. Closest remaining analog to the audio bug. | ▢ recommend |
| 9 | `lib/components/settings/EditableOrthographies.svelte:99` (same call) and `:81` `usage_count(…).then(…)` | P3 | The picker silently loses its suggestions; per-orthography "used by N entries" counts never fill in — and the delete guard then reads 0 usages. | ▢ recommend |
| 10 | `lib/db/client/connection.ts` `navigator.storage.persist().then(…)` | P4 | Rejects outright in some browsers → an unhandled rejection on every boot there. | ✅ FIXED (`.catch(() => undefined)`) |

### Checked and NOT a problem (documented so the next sweep doesn't re-walk them)

- **Every `void <call>()` through the `_call.ts` API pattern** (`api_chat_rooms`, `api_chat_heartbeat`,
  `api_video_generate_thumbnail`, …) — those helpers return `{ data, error }` and never throw. This
  is why the pattern is worth keeping.
- `lib/search/orama-watcher.ts` `void scan()` ×3 — `scan()` try/catches internally.
- `lib/search/entries-ui-store.ts` `void load_bundle_with_retry(...)` — its own try/catch + retry ladder.
- `lib/agent/email-inbound-hook.ts` `void run_triage(...)` — `run_triage` try/catches and logs.
- `lib/db/sync/engine.svelte.ts` / `dict-sync-engine.ts` `void this.sync_if_needed()` — the engines
  report failures through `report_dict_sync_failure` and never reject out.
- `lib/media/add-media.ts` + `AttachAudioModal.svelte` — `handle.done` chains end in `.catch`, and the
  error renders in the upload progress pill.
- `lib/media/TimingsEditor.svelte` waveform decode chain — ends in `.catch(() => decode_failed = true)`.

## The fix shape (now shared)

`site/src/lib/media/play-audio-element.ts` — `play_audio_element({ audio, context, on_failure })`:
names the failure (`audio_play_failed`, `warn`) with `{ url, error_name, error_message,
media_error_code, ready_state, network_state, online }` plus the caller's context, and lets the
caller restore the truth (clear `playing`, toast). Every audio site above routes through it; the
entry-page one also **tells the user** ("This audio could not be played…"), which is what was missing
when four visitors tapped five times.

## Standing rule proposed

`void promise` is not a guard — it silences the linter, not the rejection. Use it only when the
callee is known to swallow its own errors, and say so at the call site.
