# Entry history icon button

Make the entry view history action an icon-only button.

## Notes

- Target: `site/src/routes/[dictionaryId]/entry/[entryId]/+page.svelte`.
- Existing action used the legacy `Button` wrapper with visible `History` text plus a Font Awesome history icon.
- The legacy `Button` wrapper does not forward arbitrary attributes like `aria-label`, so an icon-only action should use a native button with the global button classes.

## Result

- Replaced the text+icon history action with an accessible icon-only button.
- Kept the action localized for `title` and `aria-label` via `history.history`.

## Verification

- ✅ `pnpm --dir site check`
- ✅ `pnpm -w lint -- 'site/src/routes/[dictionaryId]/entry/[entryId]/+page.svelte'`
- Screenshot attempt with Svelte-look did not render because the entry page mock lacks `page.data.t`.
