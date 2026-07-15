------------------------------------------------------------------
-- users.chat_access — explicit "admitted to /chat" grant.
--
-- A user is a chat member iff: admin (level >= 2) OR chat_access = 1 OR a member
-- of >= 1 chat room. Any chat member can DM/see any other (one circle). Admins
-- toggle this per-user from /admin/users/[id]; it's the durable way to admit
-- someone (e.g. a super manager) to chat without first putting them in a channel.
--
-- Syncs down to admin clients like the other `users` columns (download-only).
------------------------------------------------------------------

ALTER TABLE users ADD COLUMN chat_access INTEGER NOT NULL DEFAULT 0;
