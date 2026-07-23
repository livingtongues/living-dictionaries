# Orthographies (writing systems) model

How a dictionary's alternate writing systems are modeled, and the non-obvious decisions behind it.
Code: `Orthography` in `shared.types.ts`, `$lib/orthography/orthographies.ts`, `$lib/db/server/orthographies.ts`,
`$lib/components/settings/EditableOrthographies.svelte`, the `/api/v1/.../orthographies` routes, and the
Keyman lookup in `$lib/components/keyboards/keyman/writing-systems.ts`.

## The core model

`dictionaries.orthographies` (shared.db catalog JSON) is an ordered list of
`{ code, name, bcp?, notes?, primary? }`. **`code` is the immutable key** each spelling is stored under
inside every entry's `lexeme` and every sentence's `text` MultiString. `name` is the editable label;
`bcp` drives the Keyman keyboard; renaming edits `name`, never `code`.

`get_orthographies()` normalizes the stored list into `{ primary, alternates, all }`.

## Why `default` stays the primary key (decided 2026-07-01 with Jacob)

The canonical headword lives under `lexeme.default` and **~68 call sites read `entry.main.lexeme.default`**
directly (list, gallery, table, print, entry detail, SEO, share, export). The primary orthography is
always registry **slot 0 with `code: 'default'`, `primary: true`** — pinned, non-deletable, and
**synthesized when a dict hasn't configured one**, so `lexeme.default` is *always present*. Invariant:
no dictionary ever lacks a `default`-coded primary.

Rejected alternatives and why:
- **Rename `default` → the primary's BCP tag**: a BCP tag is *longer* than `default`, so it grows the
  data rather than shrinking it, and it forces every dict (incl. unknown/mixed-script ones) to declare
  a primary script. Not worth refactoring 68 accessors.
- **Shorten to a 1-char token**: saves a few KB/dict (`"default":` is <1% of a large dict file) at the
  cost of readability + the same 68-site churn.

So the upgrade was *semantic*, not a rename: you can label the primary and give it a keyboard (PATCH
`default` / the settings "1" row), but its storage key stays `default`. The asymmetry (primary keyed
`default`, alternates keyed by BCP/slug) is intentional and invisible — `code` is an internal id.

Future "promote an alternate to canonical" should be a **one-time data operation** that swaps the
`default` key's contents with an alternate's across all entries, keeping the site code simple (always
`lexeme.default`), rather than adding a per-dict `primary_code` accessor.

## Codes: BCP-47 vs custom, and Keyman

- Picking a writing system from the list sets `code = bcp` (and wires the Keyman keyboard). A `code`
  that is itself a known writing system auto-wires `bcp = code` on create.
- Custom codes are allowed (slug or BCP tag) but rejected if they collide with a known tag
  (glossing-languages ∪ additionalKeyboards ∪ the Keyman set) or a reserved token (`default`, `lo{n}`) —
  the point is to nudge users to pick known systems from the list so the keyboard hooks up.
- **Casing gotcha**: our lists use lowercase script subtags (`sat-olck`, `srb-sora`), while proper
  BCP-47 title-cases scripts (`Olck`). `is_known_writing_system` / keyboard resolution are exact-match,
  so `sat-Olck` ≠ the known `sat-olck`. Whatever tag is in our list is the one that resolves a keyboard.

## Keyman writing-systems dataset

`tools/keyman/generate-writing-systems.mjs` transforms a Keyman keyboard catalog → the minimal
`keyman-writing-systems.json` (`tag → { id, name, font? }`, ~2,204 tags), lazy-loaded in the browser.

**GOTCHA — the live API is a curated subset.** `https://api.keyman.com/cloud/4.0/keyboards` returns
only ~323 keyboards / 533 tags ("current" curated set). The vendored `tools/keyman/keyman-catalog.json`
is the COMPLETE catalog (939 keyboards / 2,204 tags) — its long tail of minority/indigenous scripts is
exactly LD's audience, so the generator defaults to it (pass `--fetch` for the smaller live set). Refresh
by saving a fuller catalog export over `keyman-catalog.json`.

## Human/agent parity

The v1 endpoints and the settings UI share `$lib/db/server/orthographies.ts` (the UI's catalog write
also runs `validate_orthographies_array`). v1 accepts a logged-in human's session cookie (editor+) as
well as an API key, so the same validated write path serves both — see the AGENTS.md parity section.

## Legacy → cutover

Legacy orthographies were `{ bcp, name: MultiString }` with positional `lo1`/`lo2` lexeme keys.
The platform cutover (`map_orthographies` + `rewrite_orthography_keys`, now in git history)
assigned `code = bcp` (slug/`orth{n}` fallback, de-duped) and rewrote every
`lexeme`/`sentence.text` `lo{n}` key to the new code. Pre-cutover VPS data was disposable. The legacy
`scripts/import/*` bulk importer still emits `lo1/lo2` and is stale (flagged for post-cutover porting).
