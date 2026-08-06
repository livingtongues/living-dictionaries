# Remove admin JSON debug buttons

Remove every admin/dev-only code-icon JSON inspection button from Living Dictionaries and House.

## Inventory

- Living Dictionaries entry action bar (`entry` row)
- Living Dictionaries dictionary settings (`dictionary` row)
- Living Dictionaries entry audio editor (`audio` row)
- Living Dictionaries sentence/text audio attachment modal (`audio` row)
- House account page (`user` row)

## Plan

- ✅ Removed all five UI call sites and their now-unused imports/guards/spacers.
- ✅ Deleted each app's unused `JSON.svelte` debug viewer and svelte-look story.
- ✅ Confirmed no code-icon/JSON viewer references remain.
- ✅ Ran both sites' Svelte/TypeScript checks, lint, and full Vitest suites.
- ✅ Visually checked the Living Dictionaries audio editor and House account page in light and dark mode.

## Verification

- Living Dictionaries: `pnpm check` — 0 errors; `pnpm lint` — pass; 2,595 tests pass (4 skipped).
- House: `pnpm check` — 0 errors; `pnpm lint` — pass; 3,585 tests pass (2 expected failures, 5 skipped).
- Final `rg` audit finds no `JSON.svelte`, `IconFaSolidCode`, code-icon import, or viewer label references in either app.
- `git diff --check` passes in both repositories.
