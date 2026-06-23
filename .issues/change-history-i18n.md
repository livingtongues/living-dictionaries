# Change-history UI — extract hardcoded English strings to i18n

The change-history read UI (built in `.issues/change-history.md`) ships with **hardcoded English
strings**. Extract them to the i18n system so translators can localize them, following the repo
convention: add keys to `site/src/lib/i18n/locales/en.json` ONLY (other locales are filled by human
translators via `pnpm --filter scripts update-locales`), and read them with `$page.data.t('…')`.

Deferred deliberately: the sentence/text detail UIs these strings live alongside aren't built yet, so
the labels may still shift; do this once the surrounding UI settles.

## Strings to extract

### `$lib/components/history/format.ts`
- `TABLE_LABELS` map (Entry, Sense, Sentence, Text, Sentence link, Speaker, Audio, Audio speaker,
  Video, Video speaker, Sense video, Sentence video, Photo, Sense photo, Sentence photo, Dialect, Tag).
- `FIELD_LABELS` map (Lexeme, Phonetic, Interlinearization, Morphology, Notes, Linguistic history,
  Sources, Scientific names, Coordinates, Elicitation ID, Definition, Glosses, Parts of speech,
  Semantic domains, Semantic domains (write-in), Noun class, Plural form, Variant, Text, Translation,
  Title, Name, File, Image, Photographer, Videographer, Source).
- `humanize()` fallback stays as-is for unknown/new columns (the schema-drift escape hatch — no key).
- `format_value` `'—'` empty marker (probably fine to leave literal).
- NOTE: `format.ts` is a plain `.ts` module with no access to `page.data.t`. Options: pass a `t`
  function into the formatter helpers, or move label resolution into the Svelte components where `t`
  is available. Decide during implementation.

### `$lib/components/history/ChangeTimeline.svelte`
- Op badge labels: `added` / `edited` / `removed`.
- `empty_label` default: "No changes recorded yet."
- "Load older changes", "Loading…".

### `$lib/components/history/ChangeHistory.svelte`
- "Could not load history: {error}".

### `src/routes/[dictionaryId]/history/+page.svelte`
- Heading "History", subtitle "Recent changes across this dictionary — who changed what, and when.",
  empty label "No changes have been recorded yet.", SEO title/description.

### `src/routes/[dictionaryId]/entry/[entryId]/+page.svelte`
- The "History" button label.
- Modal heading "History".
- The entry empty label "No changes recorded for this entry yet."

## Acceptance
- All visible change-history strings come from `en.json` via `t(…)` (except the `humanize()` fallback).
- `pnpm --filter scripts update-locales` regenerates the other locale files cleanly.
- A quick svelte-look / browser pass confirms nothing renders a raw key.
