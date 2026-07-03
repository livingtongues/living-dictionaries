# 3-tier admin levels + DB-backed super_manager role

Jacob's decisions (2026-07-03):
- Extend numeric hierarchy: **3 = Super Admin** (Jacob, Diego), **2 = Admin** (Greg, Anna),
  **1 = Super Manager** (interns — behaves like a dictionary *manager* on EVERY dictionary).
- Full role-based system still rejected; hierarchy + a future-proof `users.roles` JSON array
  column (values from a constant; only `super_manager` today, `super_editor` foreseen later).
- Levels 2/3 stay hardcoded in `$lib/admins.ts` (DB write can never escalate into admin club).
  Level 1 comes from `users.roles` containing `'super_manager'` — toggleable by any admin
  (level ≥ 2) from `/admin/users/[user_id]`.
- Interns get **no /admin access at all** (team chat moves out of /admin later — separate task,
  see `.issues/team-chat-standalone.md` + spawn a session for it at the end).
- Interns: ck1105@georgetown.edu, eviemcdonald0@gmail.com (already registered). I set the role
  on prod via SQL after deploy.
- Users page: port house's admin badges (amber L3 / indigo L2 / slate L1) + an "admins" filter
  chip (includes super managers even though not truly admins). Badge text = tier label
  (Super Admin / Admin / Super Manager), unlike house's uniform "Admin" text.
- No ntfy/ld_address for interns (they're not in ADMINS at all — fields stay required).

## Gate translation rule
"Would a dictionary manager have this inside their own dict?" → level 1 keeps it.
- `admin_level >= 1` gates STAY (verify-dict-role bypass, dict layout is_site_admin/can_edit,
  private dict visibility on / and /dictionaries, entries/contributors admin props, private tags).
- `> 1` / `=== 2` gates → `>= 3` / `=== 3` (settings page admin section, entry dev section,
  EditAudio dev field, v4 tag visibility).
- `is_admin` (allow-list fn) already excludes super managers → delete-dictionary + /admin layout
  need no change, EXCEPT `AuthUserData.is_admin` must become `admin_level >= 2` (it currently
  ORs in `admin_level !== null` which would admit level 1).

## Checklist
- ✅ Migration `shared-migrations/20260703b_user_roles.sql`: `ALTER TABLE users ADD COLUMN roles TEXT` (JSON array, NULL = none)
- ✅ `schemas/shared.ts` users: `roles: text({ mode: 'json' }).$type<SiteRole[]>()` (+ json-columns map if separate)
- ✅ `$lib/admins.ts`: AdminLevel = 2 | 3; bump ADMINS; SITE_ROLES const + SiteRole type; update doc comment + tests
- ✅ `resolve-admin-level.ts`: accept `roles`, fallback level 1; dev cookie accepts 0-3
- ✅ `get-user.ts`: select roles; `is_admin: admin_level >= 2`; AuthUserData type (`$lib/auth/types.ts`) → effective level 0-3
- ✅ Gate sweep (see rule above): entry/[entryId] +page:66, settings/+page:167, about/+page:50, EditAudio:124, tag-visibility.ts, dev-admin-level endpoint (accept 1|2|3)
- ✅ `view-as.ts`: persona labels Super Admin/Admin/Super Manager/Visitor; tests
- ✅ `AdminBadge.svelte`: 3 tiers, house palette (amber/indigo/slate), tier-name text
- ✅ Endpoint `POST /api/admin/users/[user_id]/roles` + `_call.ts` + server.test.ts (gate: allow-list admin ≥2; validates against SITE_ROLES; bumps updated_at for sync)
- ✅ User detail page: Super Manager toggle (hidden for allow-list admins), optimistic + sync — same pattern as name/unsubscribe
- ✅ Users list page: badges incl. super managers (from synced roles column) + "admins" filter chip w/ count (house port)
- ✅ Stories with `admin_level: 2` → 3 (~8 files) + AdminBadge/ViewAsBanner stories
- ✅ `api/dictionary/[id]/entry/[entryId]/+server.ts`: effective level must include DB role (users lookup by email)
- ✅ Tests: pnpm test, tsc, lint, check; svelte-look: AdminBadge, users page, user detail, ViewAsBanner
- ✅ Update `.knowledge/migration/shared-stack-conventions.md` (+ otter shared-conventions blurb if present)
- ✅ Write `.issues/team-chat-standalone.md`
- ⬜ After Jacob OKs commit/push+deploy: prod SQL to set roles for the two interns, verify (waiting on green light)
- ✅ Team-chat task done in a follow-up session (see `.issues/team-chat-standalone.md`) — NOTE: it
  squashed this issue's `20260703b_user_roles.sql` (+ the cc/bcc + channel-retire files) into
  `20260703_user_roles_chat_channels_message_cc.sql` per Jacob's keep-few-migrations rule.

## Verification lessons
- `open_shared_db(':memory:')` runs all shared-migrations — endpoint tests get the roles column free (per api-endpoint skill).
- users is download-only on admin clients; server writes via endpoint must bump `updated_at` so sync engine picks the row up.

## Completion notes (2026-07-03)
- All code + tests done; suite green (1103 passed / 3 skipped), tsc + lint + svelte-check clean.
- svelte-look verified: AdminBadge (3 tiers, light+dark), users list (admins chip counts SM,
  slate badge), user detail (Make/Remove Super Manager toggle; hidden for allow-list admins),
  UserMenu persona ladder (Super Admin/Admin/Super Manager/Visitor), ViewAsBanner.
- New server helper `$lib/server/effective-admin-level.ts` (allow-list + users.roles) — used by
  verify-dict-role, the SSR entry endpoint, and /api/dictionaries.
- FIXED pre-existing hole while here: `/api/dictionaries?visibility=private|all` had NO auth gate
  (comment said "access control rides on the page") — now requires effective level >= 1.
- Deleted dead `lib/components/ui/AdminGuard.svelte` (zero references).
- `sync-helpers.ts` VALID_COLUMNS pin test updated with `roles` (sync is SELECT*-based, new
  column flows automatically once both sides have run the migration).
- Endpoint body uses full-set semantics: `{ roles: SiteRole[] }` replaces the stored set.
- Prod check: both intern users EXIST (ck1105… id 4991369f…, evie… id b41ee390…, names
  null/"Evie McDonald"); roles stay NULL until deploy + the UPDATE below.
- Remaining after deploy: `UPDATE users SET roles = '["super_manager"]', updated_at = <now>
  WHERE email IN ('ck1105@georgetown.edu', 'eviemcdonald0@gmail.com')` on the living VPS.
