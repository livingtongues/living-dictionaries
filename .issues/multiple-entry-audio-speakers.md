# Multiple entry audio: speaker-aware playback

## Status

✅ IMPLEMENTED + VERIFIED 2026-08-04 (design locked same day via interview; decisions below).
All five surfaces live: list, table, gallery, home cards, entry-detail tiles. Unit tests, svelte-look
stories, and a real-browser pass (visitor + dev-manager) all green.

## Problem

An entry may have several pronunciation recordings, but the compact public entry surfaces play only the first one and never identify its speaker. The full entry page renders every recording, but as indistinguishable “Listen” tiles. This makes dialect variation opaque and encourages managers to preserve duplicate entries just so recordings remain distinguishable.

This is a presentation/interaction gap, not a data-model gap: each `EntryData.audios[]` item already carries its attached `speakers[]`, including the speaker name.

## Evidence

### Four-admin room (`diego-greg-jacob`, 2026-07-29–31)

- Greg reported that three communities had raised related audio-display problems within a week. The two issues were identifying which text an audio belongs to and always identifying the speaker. He suggested a hover label, shortened attribution, color, or placing audio beside its text.
- Jacob asked for examples and a sketch and said speaker identification looked straightforward.
- Cailie asked whether attribution should expose name only or also gender, dialect, and age, noting the mobile-space cost.
- Jacob parked the multi-speaker discussion for a later design pass.

The larger headword-vs-example-audio placement question is adjacent but not part of this small entry-pronunciation change.

### User support thread (`dda822c6-54b8-44ef-8348-66a5fb5e3078`)

Vincent, manager of [`'Iipay Aa`](https://livingdictionaries.app/iipay-aa/entries), requested that public “Listen” controls identify the speaker. Almost every speaker represents a different dialect for this dictionary; visible attribution would let him merge duplicate entries without losing the distinction. Jacob replied on 2026-08-03 that we would address it after finding a good solution.

Production examples:

- [`'aahmaa`](https://livingdictionaries.app/iipay-aa/entry/0FfPfUAGqZLkGqmF1p4O): six recordings, four distinct speakers, with two repeated names.
- [`pilly weraaw`](https://livingdictionaries.app/iipay-aa/entry/df439499-84c5-4f8e-aff9-49dc5601dfc5): two recordings, two speakers — the simplest intended case.
- [`nyapaach`](https://livingdictionaries.app/iipay-aa/entry/7a5ba514-206e-4ce0-8f29-2aff0df1d3d5): five recordings, all attributed to Sam Brown — proves names alone do not always distinguish the options.

Current `'Iipay Aa` counts: 4,641 entries with entry audio; 12 with multiple recordings; maximum six recordings on one entry. All 4,663 entry-audio rows have exactly one attached speaker.

## Product direction from Jacob (2026-08-04)

- Keep this visually small. A single recording should retain the familiar compact circular ear control.
- Give a multiple-recording entry a slight but legible alternate state: possibilities include stacked ears or a small count.
- Tapping a multiple-recording control reveals the individual choices in place, visually emerging beside/above the original control rather than opening a large modal.
- Each revealed choice shows only the speaker name — no gender, dialect, age, birthplace, or other profile metadata.
- The selected/playing choice changes icon/state; the other choices remain immediately tappable.
- A likely behavior is to start the first recording while revealing the choices — confirmed in the locked design below.

The control must be tap-first and keyboard-accessible; speaker identity cannot depend on hover because the request explicitly includes phones. A hover/focus tooltip may supplement the persistent revealed label.

## LOCKED DESIGN (Jacob, interview 2026-08-04)

Mockups were inline MDX/JSX in the interview chat (no artifact files); pixel-true confirmation
happens via the svelte-look stories in the implementation checklist below.

1. **Collapsed multi-recording indicator — count badge.** Keep today's exact 1.75rem circular ear
   control (`.list-play-button` visual language) and add a small count badge (recording count,
   2–6+) pinned top-right: `--primary` background, `--on-primary` text, ~2px `--surface` ring,
   ~9.5px bold. Footprint, row alignment, and touch target unchanged. Single-recording controls are
   visually unchanged.
2. **Expanded chooser — anchored popover panel.** Reuse `$lib/components/ui/Popover.svelte`
   (already used by ListEntry's ⋯ menu) anchored to the control: a floating `--surface` panel
   (~200–232px wide, shadow + hairline border) with one vertical row per recording in `created_at
   ASC` order. Each row: play icon + speaker name; the active row is filled `--primary` with a
   pause icon (`aria-pressed`, icon change — never color alone). Long names truncate with ellipsis
   against the fixed panel width; rows are comfortable touch targets. Identical presentation on
   every compact surface — this is why popover beat the in-row chip strip (table cells / gallery
   corners can't grow gracefully, and list rows must not reflow mid-scroll).
3. **First tap = expand + play recording 1.** Preserves one-tap-to-hear muscle memory; the open
   panel shows which recording is sounding and that alternatives exist. Tapping another row
   switches to it (stopping the current audio); tapping the active row pauses/stops it.
4. **Repeated names — quiet ordinal on duplicates only.** `Sam Brown 1` / `Sam Brown 2` with the
   ordinal muted + smaller; unique names get no ordinal. No profile metadata ever.
5. **Missing speaker — bare number, NOT a localized string.** A recording with no attached speaker
   is labeled with just its ordinal position number (e.g. `3`), muted/italic. Jacob explicitly
   declined a localized `Recording N` string; never show source prose in the picker.
6. **Single-recording entries — no persistent visual change, but attribution is reachable two
   ways:** (a) speaker name in the control's `title`/`aria-label`; (b) a brief "toast-like"
   transient name label after tapping play. Spec: a small bubble anchored beside the control (NOT
   the global corner toast) showing the speaker name, fading after ~2s; shown only when a speaker
   exists. Entry-detail tiles show the name persistently so they don't need the transient bubble.
7. **Close behavior — dismissal never stops audio.** Outside tap / Escape closes the panel; the
   recording plays to its end and the collapsed control keeps its "playing" state. The panel
   otherwise stays open during and after playback until dismissed. Focus returns to the control on
   Escape.
8. **Surfaces — all five in the first release:** entries list, table, gallery, dictionary-home
   cards (widen the `dict-home.ts` SSR card read shape to ordered audios + speaker names, SSR/live
   shapes identical), plus the entry-detail change: the existing per-recording 5rem tiles gain the
   speaker name (bold name + muted "Listen" caption) — no chooser there since all tiles are already
   visible.

## Current code and change surface

### Data already available — no schema/API migration expected

- `site/src/lib/types/entry.interface.ts` — `EntryData.audios[]` includes `speakers[]` with `name` and the other speaker fields; the UI can deliberately select only `name`.
- `site/src/lib/search/entry.worker.ts` — joins `audio_speakers` to `speakers`, attaches the speaker rows to every entry audio, and preserves `created_at` order.
- `site/src/lib/db/server/build-entry-data.ts` — SSR twin performs the same join for a cold entry-page load.
- `site/src/lib/search/assemble-entry-data.ts` — shared public read-model choke point retains all audio rows.
- `site/src/lib/db/schemas/dictionary.ts` — normalized `audio` ↔ `audio_speakers` ↔ `speakers` model. It technically supports more than one speaker per recording even though current editor and v1 attach flows usually assign one.

### Compact public surfaces currently discard all but audio `[0]`

- `site/src/routes/[dictionaryId]/entries/list/ListEntry.svelte` — sends `entry.audios[0]` to the circular list control.
- `site/src/routes/[dictionaryId]/entries/table/Cell.svelte` — sends only `[0]` to the table audio cell.
- `site/src/routes/[dictionaryId]/entries/gallery/GalleryEntry.svelte` — derives one `audio_storage_path` from `[0]` and owns a separate circular control.
- `site/src/routes/[dictionaryId]/home/HomeEntryCard.svelte` plus `site/src/routes/[dictionaryId]/+page.svelte` — card props contain one path only.
- `site/src/lib/db/server/dict-home.ts` — SSR home-card query selects one audio path. If home cards are in v1, widen the card read shape to ordered audio options with speaker names and keep SSR/live card shapes identical.

### Full entry page already shows every audio, but not its identity

- `site/src/routes/[dictionaryId]/entry/[entryId]/EntryMedia.svelte` loops all `entry.audios` into separate `5rem` tiles.
- `site/src/routes/[dictionaryId]/entries/components/Audio.svelte` owns list/table/entry playback and a module-level exclusive player. It accepts one `sound_file`, renders no speaker name, and mixes public playback with editor open/edit behavior.

### Playback/refactor seam

- `site/src/lib/utils/exclusive-audio.svelte.ts` already guarantees one gallery/home audio at a time but tracks only a boolean, not which audio id is active.
- `site/src/routes/[dictionaryId]/entries/components/Audio.svelte` has a separate module store that can identify the active URL.
- Prefer one feature-owned reusable control (likely under `site/src/lib/entry/`) that accepts the ordered audio objects, reports the active `audio.id`, carries playback telemetry context, and offers compact/card/detail presentation variants without duplicating selection logic.
- **Existing related playback bug to close in the refactor:** `Audio.svelte`, `GalleryEntry.svelte`, and `HomeEntryCard.svelte` pass the original URL to `new Audio(url)` through `create_exclusive_audio`; unlike the newer players, they bypass `audio_element_from_storage_path()` / `audio_sources()` and therefore bypass the `_p1.mp3` derivative → original fallback. The new control should accept `storage_path`, build the source chain through the shared helper, and key active state by `audio.id` rather than comparing URLs.
- Preserve `audio_play_failed` telemetry and add the actual entry/audio identifiers to the current generic gallery/home telemetry context.

### Explicitly out of scope

- Sentence/text karaoke players already display attached speaker attribution in `site/src/lib/media/AudioPlayer.svelte`; they are not entry-pronunciation selectors.
- Headword audio versus example-sentence audio placement is a broader content-layout question from Greg’s message.
- Speaker editing/data entry, speaker profile metadata, audio reordering, and print/export behavior.

## Behavior constraints

- Support 2–6+ recordings; never hard-code two.
- Stable order is the existing audio `created_at ASC` order unless a future audio-ordering feature adds a sort key.
- Stop the previous recording before another begins, including playback from another entry/card.
- Keep the choices open while a recording plays so the speaker name and active state remain visible.
- The active state must be more than color: icon/state plus an accessible `aria-label`/`aria-pressed` or equivalent.
- Long names must not widen an entry row/card or overflow a phone viewport.
- Close/collapse behavior needs outside tap, Escape, and sensible focus handling; stopping playback should not unexpectedly discard the chooser.
- New translation strings go in the English locale catalog only; database-backed locales follow the existing translation workflow.

## Implementation (landed 2026-08-04)

### Shared control — `site/src/lib/entry/entry-audio/`

- ✅ `audio-option-labels.ts` — pure label derivation + `from_entry_audios` adapter, inline vitest
  (unique names clean; dupes get ordinals; speakerless → bare 1-based position, `no_speaker` flag).
- ✅ `entry-audio-state.svelte.ts` — ONE module-level exclusive player for every surface, active
  keyed by `audio.id`, sources via `audio_element_from_storage_path` (fixes the derivative-fallback
  bug on gallery/home/entry), toast + clear on failure, clear on `ended`.
- ✅ `EntryAudioControl.svelte` — compact circle (`tint` list/table, `overlay` gallery/home) +
  count badge; multi tap = open `Popover.svelte` + play recording 1 (reopen while sounding doesn't
  restart); rows toggle with `aria-pressed`, pause/play icons, quiet ordinals, italic bare number
  for speakerless, ellipsis for long names; Escape/outside-tap closes WITHOUT stopping audio and
  refocuses the trigger; single tap = toggle + ~2s portaled transient speaker-name bubble
  (auto-flips below the control near the viewport top). Rows transition `color` WITH `background`
  (instant color flashed white-on-white mid-transition — caught via svelte-look).
- ✅ Telemetry: `AUDIO_PLAYED` tracked with dictionary/entry/audio ids + surface on every play,
  including gallery/home (previously generic `exclusive_audio` with no ids).
- ✅ No new EN i18n keys — reuses `audio.listen` / `misc.play` / `misc.pause` /
  `audio.playback_failed`; numeric fallback deliberately unlocalized per Jacob.

### Surfaces

- ✅ List `ListEntry.svelte` — new control, listen-only for everyone (editors still edit via ⋯).
- ✅ Table `Cell.svelte` — control for everyone + a small `.edit-audio-button` pencil for editors
  (opens EditAudio on `audios[0]`, same power as the old click-to-edit); no-audio editors keep the
  mic add tile via `Audio.svelte`.
- ✅ Gallery `GalleryEntry.svelte` — bespoke player replaced; overlay appearance keeps the white
  glass look; badge shows count.
- ✅ Home `HomeEntryCard.svelte` + `+page.svelte` + `dict-home.ts` — card shape widened from
  `audio_storage_path` to ordered `audios[{id, storage_path, speaker_name}]` in BOTH the SSR read
  (`attach_card_audios`, one grouped query per strip) and the live `card_from_entry_data` path.
- ✅ Entry detail `EntryMedia.svelte` + reworked `entries/components/Audio.svelte` — tiles show
  bold speaker name (+ quiet ordinal / italic bare number) over a muted Listen caption; editor
  click→EditAudio + longpress→play preserved; the old module store and dead list/table playback
  branches are deleted (Audio.svelte = tile + add-audio only, playback via the shared state).
- `$lib/utils/exclusive-audio.svelte.ts` remains ONLY for out-of-scope players (text-reader clips,
  homepage word cards).

### Verification (all green)

- ✅ Full vitest suite (2589 passed) incl. new label tests + widened `dict-home.test.ts` (multi-
  audio ordering + speaker-name join). `pnpm check` 0 errors; eslint clean on all touched files.
- ✅ svelte-look stories (light + dark inspected): `EntryAudioControl` Single / TwoCollapsed /
  TwoExpanded / SixExpanded (dupes + long name + speakerless) / SixExpandedPhone (bottom sheet) /
  ActiveNonFirst / TransientName; `ListEntry` VisitorMultiAudioCollapsed + Expanded;
  `GalleryEntry` MultiAudio; `HomeEntryCard` MultiAudio; `Audio` tile stories (speaker / dup
  ordinal / speakerless / editor). Stories stub `HTMLMediaElement.play` to hold active state.
- ✅ Real-browser e2e (headless puppeteer vs dev server, Dev Playground dict): badge count, first-
  tap expand+play, ordinal labels `E2E Speaker 1..3` + unique `Vincent Diego` + bare `5`, row
  switching, Escape-close-keeps-playing + focus return, single-audio transient bubble appear+fade,
  entry-tile names + id-keyed exclusivity across tiles, editor table pencil → EditAudio modal,
  editor tile click → EditAudio. Zero page errors.
- Dev seed for eyeballing left in place: Dev Playground `ja'` (5 recordings: 3× E2E Speaker,
  Vincent Diego, one speakerless) + `nyapaach` (single recording, Vincent Diego) —
  `localhost:3041/dev/entries`.
- ⬜ After deploy: spot-check the three production `'Iipay Aa` entries (`'aahmaa`, `pilly weraaw`,
  `nyapaach`) as visitor + editor.

## Work checklist

- ✅ Read the production four-admin discussion and the matching user thread.
- ✅ Trace the entry audio/speaker read model and every public playback surface.
- ✅ Record real multi-audio edge cases from the requesting dictionary.
- ✅ Fable 5 design interview and mockups (inline MDX; decisions locked above, 2026-08-04).
- ✅ Lock interaction and surface scope in this issue.
- ✅ Implement and verify (2026-08-04); the post-deploy 'Iipay Aa spot-check remains above.
