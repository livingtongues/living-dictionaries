# Restore dictionary-role badges in the admin /users list

## Goal
The old `main`-branch admin/users list managed dictionary roles **inline** per row
(`DictionariesHelping.svelte` → clickable/removable badges + add). The current
Svelte-5 list (`site/src/routes/admin/users/+page.svelte`) collapsed that to a
read-only "1 manager · 2 contributor" summary; editing moved to the per-user
detail page. Bring the inline badges back **without** losing the new
filters/search/threads columns.

## Decisions (from Jacob)
- ✅ Add badges back: clickable (open `/{dictionaryId}` in new tab) + removable (✕) + inline "+ Add".
- ✅ Reuse existing pieces — do NOT reintroduce svelte-pieces `BadgeArrayEmit` or Supabase code.
- ❌ Do NOT re-add the super-admin raw-JSON hover tooltip.

## Reused building blocks (current branch)
- `$lib/admin/DictionaryPickerModal.svelte` — props `{ dictionaries, on_select(dictionary_id), on_close }`.
- `api_dictionaries_id_roles_post(dict_id, { target_email, role })` — server-side INSERT,
  idempotent via `ON CONFLICT (dictionary_id, user_id, role)`. Used for ADD (then `data.sync.sync()`).
- Live row `role._delete()` (RowType<'dictionary_roles'> has `_delete/_save/_reset`) — used for REMOVE (then `data.sync.sync()`).
- `db.dictionaries.objects` (name lookup) + `db.dictionaries.rows` (picker source) — admin shared.db catalog.
- Pattern mirrors `[user_id]/+page.svelte` role add/remove exactly.

## Plan
- [x] Add `role_rows_by_user_id: Map<string, RowType<'dictionary_roles'>[]>` derived (keep existing counts map for sort/filter/CSV).
- [x] Add `dictionaries_objects` + `all_dictionaries` deriveds.
- [x] Replace the "Dictionary roles" cell summary with badges grouped/colored by role
      (manager=primary, editor=warning, contributor=success). Each badge: name link (new tab) + ✕ remove.
- [x] Per-row "+ role…" native `<select>` (manager/editor/contributor) → opens DictionaryPickerModal
      pre-scoped to that role, excluding dicts the user already holds that role for.
- [x] `start_add_role` (guards no-email), `confirm_add_role` (API + sync), `remove_role` (confirm + `_delete` + sync).
- [x] Remove now-unused `roles_summary()` helper.
- [x] Update `_page.stories.ts` mock to include a `dictionaries` table so badges render names.

## Verify
- [x] `pnpm --filter=site check` → 0 errors
- [x] `pnpm lint:fix` on changed files
- [x] svelte-look screenshot of the List story (badges visible, colored, add control)
- Jacob eyeball on live dev for click/remove/add against real sync.
