# Search character tap-buttons (special characters per orthography)

Spec origin: `.issues/ponca-import.md` → "NEXT UP — the search character tap-buttons".
Ponca's alphabet has characters nobody can type (`đ ʼ ə ʃ ą ę į ų ǫ š ž č ·`) so the search box
needs a compact row of tappable buttons that insert the character at the caret.

Jacob: *"something very simple, not a Keyman keyboard"* + *"do it in a way that works for more
than just one dictionary"* — feed from the registered orthography if it lands cleanly.

## Design (chosen)

**Data-driven, zero hardcoding.** `Orthography` gains an optional `characters?: string[]` — the
special characters that writing system needs. Stored in the existing catalog JSON
(`shared.db dictionaries.orthographies`), so it inherits the whole existing plumbing: the settings
editor, the v1 `/orthographies` endpoints, the catalog write path, snapshot/sync. No migration.

The search box renders the union of every registered orthography's `characters` (registry order,
deduped). No characters configured → nothing renders (no surprise row on 800 dictionaries).

A **Detect** button in the settings editor scans that orthography's own lexemes in the local
wa-sqlite dict.db and proposes a frequency-ranked non-ASCII inventory, so any manager can populate
it in one click and then trim. That's the "works for more than one dictionary" answer.

## Files

- [x] `src/lib/db/schemas/shared.types.ts` — `Orthography.characters?: string[]`
- [x] `src/lib/orthography/special-characters.ts` — `get_special_characters`,
      `parse_characters_input`, `format_characters`, `validate_characters`,
      `derive_special_characters` (+ inline vitest)
- [x] `src/lib/utils/insert-at-caret.ts` — pure `insert_at_caret({ value, start, end, text })`
      → `{ value, caret }` (+ inline vitest)
- [x] `src/lib/orthography/SpecialCharacterButtons.svelte` (+ `.stories.ts`) — dumb row of buttons,
      `characters` + `on_select`
- [x] `src/routes/[dictionaryId]/entries/SearchInput.svelte` — optional `special_characters` prop,
      inserts at the caret and keeps focus (+ `SearchInput.stories.ts`)
- [x] `src/routes/[dictionaryId]/entries/+page.svelte` — feeds it from `dictionary.orthographies`
- [x] `src/lib/components/settings/EditableOrthographies.svelte` — per-orthography characters input
      + Detect
- [x] `src/lib/db/server/orthographies.ts` — validate/persist `characters` on create/patch/array-write
- [x] `src/lib/api/v1/openapi.ts` — document `characters` on OrthographyInput + PATCH
- [x] `src/lib/search/augment-entry-for-search.ts` — ADJACENT BUG: `ə` U+0259 was missing from
      `ipa_to_common_keyboard` (only the turned-e `ǝ` U+01DD and `ɘ` were mapped) so Ponca's schwa
      had no ASCII-typable search form; `đ` had none either (`ð`/`ɖ` did). Added `ə → e`, `đ → d`.

## Verified

- `pnpm vitest run` (2183 pass), `tsc`, `pnpm lint`, `pnpm check` (0 errors) — 2026-07-27.
- svelte-look stories: `/lib/orthography/SpecialCharacterButtons` +
  `/routes/[dictionaryId]/entries/SearchInput` (light + dark).
- Headless puppeteer against dev 3041 on `tutelo-saponi`: **Detect** proposed
  `ą é á ǫ į ʰ í ą́ č ú – ó ǫ́ į́ š ų́ ʔ ų ę ’ ə ṭ` from 1,682 real headwords and saved to the
  catalog; on `/entries` the row rendered, a mid-word tap inserted at the caret (`ma` + caret@1 →
  `mąa`, caret 2, input still focused), the `?q=` param updated, and `mą` searched to 221 results.
  No page/console errors. Mobile 390px + dark mode checked.
- `.search-bar` moved from `align-items: center` to `flex-start` so the view switcher stays level
  with the input now that the search column can be two rows tall.
- Deleted `$lib/components/keyboards/SpecialCharacters.svelte` — a dead stub (comments only, zero
  references) from an abandoned earlier attempt at this same feature.

## Notes

- Search already strips combining diacritics (NFD + `̀-ͯ`) when building `_lexeme`
  simplified tokens, so `ą á ę` are all findable by typing plain `a`/`e`. The buttons still carry
  them because people type real words, but the characters that genuinely NEED a button are the
  precomposed/IPA ones: `đ ʼ ə ʃ ·`.
- A button value may be a multi-codepoint grapheme (`ą́` = `ą` + U+0301 — there is no precomposed
  form), hence per-character length is capped at 8 UTF-16 units, not 1.
- Ponca itself is configured as DATA once the dictionary lands (settings page or
  `PATCH /api/v1/dictionaries/ponca/orthographies/default`), not in code.
