# Hide empty export media options

Managers currently see disabled Images/Audio export checkboxes plus red "There are no ..." notes when a dictionary has no media. The requested behavior is to omit those media rows entirely unless the export actually has image or audio files.

Plan:
- ✅ Locate the export page and existing visual stories.
- ✅ Update the export page to render media checkboxes only while there are media files available.
- ✅ Add a visual story for a manager with entries but no media.
- ✅ Verify with targeted Svelte check / visual screenshot.

Notes:
- Keep the CSV export visible for dictionaries with entries even when no media exists.
- `pnpm check` passed in `site` with 0 errors.
- Root `pnpm lint` passed.
- `svelte-look` `ManagerWithoutMedia` screenshot shows only "Data as .CSV" and "Download CSV".
- `svelte-look` `ManagerWithMedia` screenshot still shows Images and Audio options when files exist.
