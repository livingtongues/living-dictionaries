# Admin URL state and translator UI

Implement the four requests from the 2026-07-22 admin feedback recording, and audit Living
Dictionaries, House, and Tutor for durable admin view state that should be directly linkable.

## Feedback requests

1. Make the Living Dictionaries Users → Translators view directly linkable.
2. Show a translator badge and every assigned language beside translator names; assignments are
   one-to-many (for example, Luke translates two languages).
3. Distinguish Translate-page locale cards with assigned translators from unassigned locales.
4. Make translation-value textareas recognizably editable and easier to scan.

## Agreed URL-state principles

- URL state is for a durable view identity: tabs, categorical filters, searches, sorting,
  pagination/ranges, and focused schema tables.
- Transient interaction state stays local: dialogs, expanded rows, unsaved drafts, busy/error
  flags, audio playback, and temporary compose state.
- Omit default values from URLs where practical; validate every incoming value and fall back safely.
- Preserve unrelated query parameters when one control changes.
- Prefer readable independent parameters (`filter`, `q`, `sort`, `dir`, `page`) over one opaque JSON
  blob for admin pages.
- History is hybrid: discrete, meaningful view changes (tabs, filters, pages, sources, ranges) push
  a history entry; high-frequency search and sorting changes replace the current entry.

## Audit inventory

### Living Dictionaries

- `/admin/users`: add URL-backed `filter`, `q`, `sort`, `dir`, and `page`.
- `/admin/dictionaries`: `filter` exists but currently overwrites other state; add/preserve `q`,
  `sort`, `dir`, and `page`, including back/forward synchronization and validation.
- `/admin/schema`: add `source`; retain existing `table` focus and clear focus on source changes.
- `/admin/featured-words`: add status tab.
- `/translate`: `locale` and `filter` already exist; add `q` and preserve parameters together.
- Already linkable: analytics/health audience, schema table focus, message status routes.

### House

- `/admin/users`: add URL-backed `filter`, `q`, `sort`, and `dir`.
- `/admin/data`: complete existing `table` deep links with `source`, `sort`, `dir`, `page`, and
  column filters; reserve control keys so they are not mistaken for column filters.
- `/admin/revenue`: add chart `range`.
- `/admin/content/entities`: add top-level `tab`; add the nested coverage filter and Easton preview
  search when those panels are active.
- `/admin/content/proofread`: add Articles/Images tab.
- `/admin/content/proofread/changes`: keep date params and add category/source/publication facets.
- `/admin/content/followups`: add To do/Done view and published/unpublished scope.
- `/admin/content/easton`: add server-correct initial filter plus client navigation.
- `/admin/content/reference-pastes`: add source filter.
- `/admin/content/placeholders`: add notes/empty filter.
- `/admin/chat`: retain room deep links but make room changes push history and restore the room on
  Back/Forward.
- Already linkable: content area route tabs, analytics/health audience and analytics range, schema
  source/table, newsletter contacts list/search/offset, message status routes.

### Tutor

- `/admin/users`: add URL-backed `filter`, `q`, `sort`, and `dir`.
- `/admin/schema`: add `source`, `view`, and focused `table` (matching LD/House).
- `/admin/leveling/word-audio-review`: add Flagged/All view.
- `/admin/leveling/ours/[language]`: add band and search.
- `/admin/leveling/domains/[language]/[domain]`: add band and search.
- `/admin/leveling/sources/[language]/[source_id]`: add search and page.
- `/admin/tts-workbench`: add comparison locale and passage tabs if durable-tool state is in scope.
- `/admin/chat/lab`: keep existing user/chat/mode params but make meaningful selections push
  history instead of replacing it.
- Already linkable: analytics/health audience, chat route tabs, chat-lab user/chat/mode, lesson and
  dream user filters, leveling compare selections.
- Candidate exclusion: per-card prompt-editor locale tabs. Several independent editors render on
  one page and the tab only changes which unsaved draft field is visible; it does not identify a
  shareable page view.

## Translator implementation notes

- The existing admin-only `/api/translate/summary` response already returns each translator's
  `user_id` and `locales`; no schema migration is required.
- Replace the Users page's `Set<user_id>` with a locale map and render one compact translator badge
  per translator containing every localized language name.
- Locale cards can use an assigned/unassigned class and an explicit `No translator` label so the
  distinction does not rely on color alone.
- Give translation textareas persistent but subtle input chrome, with a stronger focus state.

## Verification plan

- Add/extend focused unit tests for URL parsing/updating and invalid/default parameter handling.
- Update svelte-look stories for translator badges, multi-language translators, assigned/unassigned
  locale cards, and translation textarea states; inspect light/dark screenshots.
- Run `svelte-fix.js` on every modified component.
- Run relevant Vitest tests plus `pnpm check` and `pnpm lint` in each touched `/site`.
- Browser-test direct entry, reload, copy/paste, and back/forward behavior for representative pages
  in all three apps; capture screenshots for the visible Living Dictionaries changes.

## Progress

- ✅ Processed and segmented the feedback recording.
- ✅ Read the Svelte, Svelte UI, and Living Dictionaries database skills.
- ✅ Audited durable admin view state across all three repositories.
- ✅ Jacob selected durable view state and hybrid history semantics.
- ✅ Implement Living Dictionaries feedback and URL state.
- ✅ Implement the House audit fixes, including the newly pulled Entities/Easton preview search.
- ✅ Implement the Tutor audit fixes against its freshly pulled admin pages.
- ✅ Complete automated and visual/browser verification.

## Verification notes

- ✅ Shared URL helper tests: Living Dictionaries 3/3, House 3/3, Tutor 3/3.
- ✅ `pnpm check`: 0 errors in all three apps (existing warnings remain).
- ✅ `pnpm lint`: clean in all three repositories.
- ✅ Full Vitest: LD 248 passed + 1 skipped (1,787 tests passed); House 268 passed + 1 skipped
  (1,960 passed, 2 expected failures, 3 skipped); Tutor 337 passed + 2 skipped (2,784 passed,
  9 skipped).
- ✅ Living Dictionaries svelte-look: Users and Translate Admin inspected in light and dark. The
  badge shows both assigned languages; locale cards distinguish assigned/unassigned explicitly;
  textareas retain visible input chrome.
- ✅ Headless browser: direct entry, reload, meaningful push navigation, and Back restoration passed
  without page/console errors for LD Users, House Entities/Easton, House Chat rooms, and Tutor
  Schema.
- ✅ Fixed a small unrelated House browser error found during verification: the documented benign
  `Sync already in progress` leader race is now caught at the admin-layout mount call site.
