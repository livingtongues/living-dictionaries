# "View as…" admin persona preview (port from house)

Port the admin-only, client-only, in-memory persona preview from **house** to **LD**. A real
admin can step **down** the ladder to see what lower-privileged users see while staying a real
admin server-side (a hard reload resets to real you; endpoints still gate off the JWT).

House is the reference: `/home/jacob/code/house/.issues/view-as-persona-preview.md` and the
files under `house/site/src/lib/auth/` + `components/shell/`.

## LD vs house differences (decided)
- LD `AuthUser` has only `is_admin` + `admin_level` (1|2) — **no** is_editor / is_subscriber /
  subscriptions. Ladder is `Admin · level N … → Visitor (0)`. DROP the Subscriber persona and
  all `is_subscriber` logic. `PreviewState`/`Persona` carry only `admin_level`.
- **Q1 = reactive (Jacob):** make `auth_user.is_admin` / `admin_level` preview-aware getters and
  migrate every `page.data.admin` consumer to read `auth_user.*` (reactive). REMOVE
  `page.data.admin` from `+layout.ts` (redundant second, non-reactive source of truth). `pnpm check`
  will flag every remaining `data.admin` reference for migration.
- **Q2 = extract (Jacob):** extract `UserMenu.svelte` (menu inner content + ladder) rendered inside
  `<Menu>` in `User.svelte`.
- Use `$app/state` `page` in UserMenu + ViewAsBanner (root `+layout.svelte` already does; svelte-look
  shims `$app/state`, not `$app/stores`).
- Banner: bottom-RIGHT, `z-[501]`, hidden below `sm`. LD `Toasts` root is `z-500`, fixed, bottom
  full-width centered — same collision shape as house, so bottom-right clears it.
- Leave the dev-only `dev_admin_level` cookie toggle + `/api/auth/dev-admin-level` ALONE.

## page.data.admin consumers migrated → auth_user.* (preview-aware)
The blast radius was wider than the first 6 — `pnpm check` (after removing the type decl) surfaced
the rest. `EditImage.svelte` `admin > 1` turned out to be inside a comment (pre-existing dead code,
left alone); also fixed a latent miss there.
- [x] `src/lib/components/audio/EditAudio.svelte` (`admin > 1`)
- [x] `src/lib/components/entry/EntryTag.svelte` (`should_include_tag(tag, admin)` — live tag filter)
- [x] `src/lib/components/home/Search.svelte` (`admin` only in a comment — dropped the destructure)
- [x] `src/lib/components/modals/SelectLanguage.svelte` (`{#if admin}`)
- [x] `src/lib/components/ui/AdminGuard.svelte` (`{#if admin}`)
- [x] `src/routes/dictionaries/+page.svelte` (`admin >= 1` private filter + admin button)
- [x] `src/routes/+page.svelte` (fetch private dictionaries + Toggle-Private map control)
- [x] `src/routes/[dictionaryId]/entries/+page.svelte` (`admin={admin > 0}` SEO)
- [x] `src/routes/[dictionaryId]/contributors/+page.svelte` (`admin > 0` + Partners `admin` number)
- [x] `src/routes/[dictionaryId]/about/+page.svelte` (`admin > 1`)
- [x] `src/routes/[dictionaryId]/export/+page.svelte` (`{#if admin}`)
- [x] `src/routes/[dictionaryId]/settings/+page.svelte` (`admin` + `admin > 1`)
- [x] `src/routes/[dictionaryId]/settings/+page.ts` (load `if (admin)` → `auth_user.is_admin`)
- [x] `src/routes/[dictionaryId]/entry/[entryId]/+page.svelte` (`dev || admin > 1`)
- [x] `src/lib/components/shell/User.svelte` (Admin Panel link + dev role text → moved to UserMenu)
- [x] `src/routes/+layout.ts` — removed `admin: ssr_user?.admin_level ?? 0`
- [x] `src/lib/mocks/layout.ts` — removed `admin: 0`
- [x] `src/app.d.ts` — removed `admin: number` from `App.PageData` (the real second source of truth;
  this is what made every load demand an `admin` key once the layout stopped returning it)

## New / changed files
- [x] `src/lib/auth/view-as.ts` — pure helpers (no is_subscriber) + inline vitest tests (11 pass).
- [x] `src/lib/auth/user.svelte.ts` — `preview` `$state`, `real_is_admin` / `real_admin_level` /
  `previewing` / `preview_label` getters, preview-aware `is_admin` / `admin_level`, `set_preview`
  (guarded to real admins, clamped down) / `exit_preview`; clear `preview` on logout.
- [x] `src/lib/components/shell/UserMenu.svelte` — menu content + View-as ladder + dev toggle.
- [x] `src/lib/components/shell/User.svelte` — render `<UserMenu>` inside `<Menu>`.
- [x] `src/lib/components/shell/ViewAsBanner.svelte` — preview pill, added to root `+layout.svelte`.
- [x] Stories: `UserMenu.stories.ts` (AdminLadder + PreviewingVisitor), `ViewAsBanner.stories.ts`.

## Known gap (mirrors house's accepted search gap)
Per-dictionary entries search + `can_edit` / `is_manager` are computed once in
`[dictionaryId]/+layout.ts` from `auth_user.admin_level` and wrapped in `readable()`. Making the
getter preview-aware means they downgrade **on the next navigation into a dictionary** (private
entries filtered out, edit affordances off), but NOT live while already sitting on the page (no
invalidation). Acceptable — same shape as house's search-bound-once gap.

## Verify
- [x] `pnpm test` — view-as 11/11; auth+search+seo 51/51 pass.
- [x] `pnpm check` — 0 errors (18 pre-existing warnings).
- [x] `pnpm lint` — clean on all changed files.
- [x] svelte-look stories: UserMenu (AdminLadder shows real→1→Visitor; PreviewingVisitor hides
  Admin Panel, keeps the ladder, dev text still shows real level 2) + ViewAsBanner (bottom-right
  pill renders for both visitor + admin-level-1 personas). FA glyphs (the active ✓) don't load in
  svelte-look, but the gating logic is verified.
- [~] Live dev check: covered by the svelte-look component stories (same components, same page.data).
  A full logged-in walkthrough on :3041 was not run (needs an admin session); left for Jacob if
  desired.

## Status: COMPLETE — awaiting Jacob's review. Not committed.
