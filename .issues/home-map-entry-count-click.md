# Homepage map entry-count click target

The homepage map's red featured-dictionary connector label renders
`Dictionary · N entries`, but only the dictionary-name portion opens the
dictionary popover. The suffix falls outside the canvas hit target.

## Plan

- ✅ Trace the canvas label rendering and hit-testing paths.
- ✅ Expand connector-label hit targets to cover the complete visible label in
  both force-laid and clustered/floating states.
- ✅ Add a svelte-look interaction story that clicks the entry-count end of the
  label and expects the dictionary popover.
- ✅ Run Svelte analysis, type/Svelte checks, lint, tests, and browser screenshot
  verification.

## Verification

- `svelte-fix`: no component issues.
- `pnpm --dir site check`: 0 errors (47 pre-existing warnings).
- Targeted ESLint: 0 errors (5 pre-existing `WorldMap.svelte` warnings).
- `pnpm --dir site test --run`: 2,105 passed; 3 skipped.
- `svelte-look` `HeroUnit/ConnectorEntryCountClick`: the story finds a pointer
  hit target only within the count suffix, clicks it, and renders the dictionary
  popover in both light and dark screenshots.
