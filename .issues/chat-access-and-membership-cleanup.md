# Chat access grant + membership model cleanup + message-paste fix

Requested by Jacob (2026-07-15). Combines a chat-access feature, a membership
model redesign, prod data fixups, and a message-composer paste fix.

## Decisions (from interview)
- Q: grant storage → **dedicated `users.chat_access` boolean column** + own toggle endpoint.
- Q: DM model → **one circle**: any chat member can DM/see any other chat member.
- Q: All Admins room → **removed from the app entirely** (boot no longer seeds it).
- Q: Anna off Notifications → **stop auto-seeding Notifications membership from the admin list entirely** (fully UI-managed).
- Q: System in member list → **thorough fix**: stop adding System as a member + filter it from member lists + delete the row.
- Q1 Evie → just needs DM access → covered by the chat-access grant (circle model), no pre-created DM rooms.

## Chat-member definition (single source of truth)
A user is a chat member iff: admin (level ≥ 2) **OR** `chat_access = 1` **OR** member of ≥ 1 room.
DM allowed iff both parties are chat members. Directory = all chat members (minus self + System).

## Code changes — ✅ DONE (tests + svelte-check + lint green)
- ✅ Migration `20260715_chat_access.sql`: `ALTER TABLE users ADD COLUMN chat_access INTEGER NOT NULL DEFAULT 0;`
- ✅ Drizzle `shared.ts` users: add `chat_access` boolean col.
- ✅ `get-user.ts`: include `chat_access` in `is_chat_member`.
- ✅ chat-db.ts: add `is_chat_member_by_id` + `can_dm`; redefine `list_chat_directory` to all chat members; removed `shares_room`; filter SYSTEM_USER_ID from `list_my_rooms.member_ids`.
- ✅ DM endpoint: use `can_dm`.
- ✅ `api.ts` `gate_chat`: new membership check (admin OR chat_access OR room); dropped `ensure_admin_system_memberships`.
- ✅ `ensure-team-membership.ts`: gutted to `ensure_notifications_room` only (no all-admins, no membership seeding, no user-row creation).
- ✅ `hooks.server.ts`: updated call + comment.
- ✅ `system-notifier.ts`: removed the System membership INSERT (keeps room + user upsert).
- ✅ `chat/constants.ts`: removed ROOM_ALL_ADMINS; SYSTEM_ROOM_IDS = [ROOM_NOTIFICATIONS]; updated server re-export.
- ✅ `20260703` migration seed: dropped all-admins (fresh DBs never create it).
- ✅ Toggle endpoint `/api/admin/users/[id]/chat-access` + `_call.ts`.
- ✅ UI toggle in `admin/users/[user_id]/+page.svelte` (verified via svelte-look).
- ✅ Fix: paste image into `reply-composer.svelte` (mirrors compose-email-modal).
- ✅ New test helper `chat-test-helpers.ts` (`seed_admins_in_notifications`); updated tests + stories.
- ✅ AGENTS.md `/chat` gate description updated.

## Prod data ops — ⏳ RUN AFTER DEPLOY
Script prepared at `/tmp/ld-chat-prod-ops.js` (idempotent). MUST run only after the
new code is live on prod (chat_access column exists + boot no longer re-seeds).
1. Back up shared.db: `ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'`
2. `ssh living 'docker exec -i sveltekit_blue node' < /tmp/ld-chat-prod-ops.js`
The script: grants chat_access to Cailie+Evie; moves the all-admins message → top of
diego-greg-jacob; adds Cailie to diego-greg-jacob + notifications; removes Anna + System
from notifications; tears down the all-admins room; prints a read-back for verification.

## Notes / gotchas
- Removals (Anna, System, all-admins) only STICK once the new no-reseed code is live — run prod ops post-deploy.
- Chat tables are server-only (not synced); prod ops are plain SQL on shared.db. `users.chat_access` DOES sync down.
- Admins always pass the gate via level ≥ 2, so they don't need room membership; they only see Notifications if explicitly a member (Diego/Greg/Jacob stay members; new admins added via UI).
