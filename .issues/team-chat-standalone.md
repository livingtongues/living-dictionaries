# Move team chat out of /admin → standalone /chat, membership-based, DB-managed channels

STATUS: ✅ COMPLETE (2026-07-03) — all code + tests + visual + e2e verification done; awaiting
Jacob's review/commit. See "Completion notes" at the bottom.

Jacob's decisions (interview 2026-07-03, this session):

- **Route: `/chat`** (not /team — members may be partners, not "team"). Standalone page with the
  site Header, NOT under /admin.
- **Endpoints move** `/api/admin/chat/*` → `/api/chat/*` (renamed `AdminChat*` → `Chat*`,
  `api_admin_chat_*` → `api_chat_*`).
- **Gate = chat-room membership** (fresh shared.db lookup in endpoints). Page navigation gate rides
  on SSR data — `AuthUserData.is_chat_member` (admins short-circuit true; boot seeds them) — no
  extra server call to navigate.
- **NO MORE FIXED_CHANNELS** — all channels are DB rows managed via UI ("cleaner in the long run").
  The four existing rooms became seeded DB rows with `chat_rooms.admin_room = 1`: such rooms are
  only manageable by **super admins (level 3)**; other channels by admins **level ≥ 2**. Manager
  must be a member (per-room privacy holds for admins too). Creation: level ≥2, creator auto-joins;
  level 3 gets an "admin room" checkbox. Deleting the two system rooms (`all-admins`,
  `notifications`) is refused server-side.
- **Directory generalized**: "people who share a channel with me" (union across my rooms, self
  included, System excluded). Names from `users.name` (fallback email). DMs allowed only with
  people sharing a room (enforced server-side via `shares_room`).
- **Member picker**: search ALL registered users (`/api/chat/users?q=`, gate level ≥2 — partners
  cannot enumerate the user base).
- **Notifications**: non-admin members always get EMAIL (`notify_chat_member`); admins keep their
  ntfy/email pref. Same one-ping-per-unread-batch policy + gentle reping cron (now reaches
  non-admins too). All deep links → `/chat?room=…`.
- **`notifications` system room stays admins-only** (admin_room + level-3 manage gate protects it).
- **Entry points**: "Chat" link + unread badge in UserMenu (when `is_chat_member`) + small unread
  dot on the avatar button. Site-wide rooms-poll (30s) only for chat members (root layout);
  presence heartbeat ONLY on /chat + inside /admin (partners browsing the site still get pings).
- **/admin/team** → 301 redirect to /chat (preserves ?room). Admin nav item + dashboard box stay,
  pointing at /chat.
- **Migration squash**: prod had applied ONLY `20260702_initial.sql` (verified via ssh). The three
  uncommitted 20260703 files + this task's schema were squashed into
  `20260703_user_roles_chat_channels_message_cc.sql` (roles, cc/bcc, chat_rooms
  created_by_user_id + admin_room, anna-greg-jacob retire, room seeds + memberships).
- Chat UI stays EN-only (like admin).

## What shipped (map)

- `lib/chat/` (moved from `lib/admin/chat/`): constants.ts (was rooms.ts — only SYSTEM room ids
  remain), chat-store.svelte.ts (split `start_rooms_poll` / `start_presence`), composer +
  message-item + attachments, NEW `new-channel-form.svelte` + `room-members-popover.svelte`
  (members + DM + manage: add/remove member w/ debounced user search, rename, delete).
- `lib/server/chat/`: chat-db.ts (+ `create_channel` `rename_room` `delete_room`
  `add_room_member` `remove_room_member` `has_any_membership` `shares_room`
  `list_chat_directory` `can_manage_room`; − `ensure_my_chat_setup`; **body_html sanitized with
  `xss` at post/edit** — non-admins author now), api.ts (`gate_chat` membership gate +
  `gate_chat_manage`), ensure-team-membership.ts (boot: system rooms + admin memberships;
  `ensure_admin_system_memberships` backstop used by the gate), chat-notify.ts
  (`author_display_name`, `notify_chat_member` path), system-notifier + reping cron → /chat links.
- `lib/notifications/notify-admins.ts`: `send_ping_email` takes `{ email, name }`; NEW
  `notify_chat_member` (admin → pref channel; non-admin → email always).
- `lib/r2/delete-attachment.ts` (channel delete cleans R2 blobs best-effort).
- `routes/api/chat/*`: 10 moved endpoints + NEW `channels` (create), `channels/rename`,
  `channels/delete`, `channels/members/add`, `channels/members/remove`, `users` (search) — all
  flat-POST style w/ `_call.ts`. 6 `server.test.ts` files cover the gates (21 tests).
- `routes/chat/+page.svelte` + `_page.stories.ts` (5 stories: SuperAdminManage, AdminViewOnly,
  Partner, NotAMember, SignedOut). `routes/admin/team/+page.ts` = redirect.
- Auth: `get-user.ts` computes `is_chat_member`; `AuthUserData` + `AuthUser` getter (hidden when
  previewing as Visitor).
- Shell: UserMenu Chat link + badge, User.svelte avatar unread dot, root layout starts rooms poll
  for members.

## Verification done
- pnpm test 1136 passed / tsc / lint / svelte-check all clean; `pnpm build` passes.
- svelte-look: all 5 /chat stories (light+dark, desktop+mobile), new-channel-form, message-item,
  UserMenu.
- Browser e2e (`site/tools/e2e/chat-standalone.mjs`, headless, 13 checks ALL PASS): partner
  registers → invite-only gate; admin creates channel via UI → adds partner via search; partner
  sees only that channel, no manage UI, posts; admin receives via poll w/ author name; UserMenu
  Chat link; /admin/team?room= redirect.

## Lessons / gotchas discovered
- **The squash broke local dev DBs that ran the old file names** (tests open `.data/shared.db` via
  `get_shared_db()` in some endpoint paths!). Fixed mustang's `.data/shared.db` surgically:
  applied only the new bits + swapped `migrations` rows. Prod + other admins' browser mirrors are
  unaffected (they only ever applied `20260702_initial.sql`).
- **svelte-look csr stories crashed on `$env/dynamic/public`** (kit's client virtual module reads a
  runtime-injected global the mount page lacks; pulled in via Header → google-one-tap). Fixed IN
  svelte-look (`src/render/vite-loader.ts` shims `virtual:env/dynamic/public` → `export const env
  = {}`, rebuilt dist) — that repo has an uncommitted change Jacob should commit.
- `ensure_my_chat_setup`'s `members: 'all'` would have admitted EVERY caller once the admin gate
  relaxed — replaced by boot-only seeding + `ensure_admin_system_memberships` (level ≥2 only).

## After Jacob commits + deploys
- The squashed migration applies itself on boot (server + admin browser mirrors).
- Set intern roles SQL (from `.issues/admin-levels-super-manager.md`) — unchanged.
- Add interns/partners to channels via the /chat UI (no SQL needed).
- Also commit `~/code/svelte-look` (env shim fix).
