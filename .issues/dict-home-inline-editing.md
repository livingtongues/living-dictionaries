# Dictionary home: inline editing for managers + wide-screen reflow

Home page (`/[dictionaryId]/home`, admin-3 preview) gains in-place editing so settings
becomes unnecessary for these fields. **Permissions unchanged** — the catalog endpoint
stays manager-gated; home shows edit affordances only when `is_manager`.

## Decisions (from Jacob)
- Manager-and-above only (server gate untouched).
- Settings page keeps duplicated fields **until home GA** (when home replaces the
  `/{dict}` → entries redirect). ⚠️ AT GA: remove from settings — name, ISO 639-3,
  glottocode, gloss languages, orthographies, alternate names, location, featured image.
- Edit UX = compact modal (one reusable component), not in-place inputs.
- Orthographies show as a labeled chip row in the hero.
- Map untouched (another agent fixing mapbox edit; later: static mapbox image for
  non-editors + move settings map components to home for editors).
- Wide screens: remove the 64rem page cap; strips/stats span full width.

## Plan
- ✅ `home/HeroFieldModal.svelte` — compact Modal + Form + input for name / iso_639_3 /
  glottocode / location (reuses Modal, Form, Button).
- ✅ Hero affordances (manager only): pencil next to h1; chips for ISO/glotto become
  buttons; dashed `+ add` pill when empty; location + alternate names same treatment.
- ✅ Gloss-language chips: pencil affordance → modal wrapping `EditableGlossesField`
  (add flow + remove; remove_gloss_language admin-confirm logic ported from settings +page.ts).
- ✅ Orthographies chip row in hero (visible to all when configured) → modal wrapping
  `EditableOrthographies`.
- ✅ Hero image controls (manager, hidden for con-langs like settings): no image → "Add
  cover photo" button; has image → replace + delete buttons (top-right overlay). Drag &
  drop an image anywhere on the hero = upload. Upload progress overlay. Reuses
  `upload_image` (`{dict_id}/featured_images` folder) — helper in `home/hero-image.ts`.
- ✅ NudgeCard: image nudge triggers the hero upload (callback) instead of linking to settings.
- ✅ Layout: drop `.home` max-width + hero-content 36rem cap; two-col panels breathe on wide.
- ✅ Fix stale `_page.stories.ts` (passed `ssr_featured` top-level; page reads `home_data`) +
  add manager-editing story; svelte-look verify wide + mobile.
- ✅ New EN i18n keys under `dict_home` (add_cover, replace_cover, delete_cover + drop hint);
  reuse existing settings/create/misc keys elsewhere.

## Notes / gotchas
- `con_language_description` dictionaries: hide ISO/glotto/location/featured-image edits
  (mirrors settings).
- `update_dictionary` comes from the dict layout load; invalidates
  `DICTIONARY_UPDATED_LOAD_TRIGGER` so `dictionary` refreshes after save.
- gloss-language removal for non-admin managers = "contact us" alert (in-use safety),
  same as settings.

## Bug found & fixed along the way
- **Catalog edits never refreshed the UI app-wide**: `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)`
  only re-ran the universal `+layout.ts` — a universal load's `depends` does NOT drag its
  server parent along, so `+layout.server.ts` kept serving the cached dictionary row. Settings
  never noticed because its inputs hold local state. Fixed by registering the trigger in
  `+layout.server.ts` too (constant moved to `$lib/constants` so the server can import it
  without pulling in the browser-only `db-operations` module). Verified via headless e2e:
  name/ISO/glotto/location edits now repaint the hero immediately after save.

## Lessons learned
- Nested modals (EditableGlossesField/EditableOrthographies open their own picker Modal
  inside our wrapper Modal) work fine — portal + same z-index, later node paints on top.
- `t()` from `page.data` in stories requires `mock_t`; new keys must be in EN json for
  stories to render them.
