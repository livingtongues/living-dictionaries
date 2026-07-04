# System notification user links

Goal: System messages in the Notifications chat room should link user names/emails to the admin user page when the relevant user id is known, e.g. `/admin/users/<user_id>`.

Plan:
- [x] Locate system notification formatters and call sites.
- [x] Add optional user ids to notification formatter inputs.
- [x] Link the new signup actor, dictionary creator, and invite actor in `body_html`.
- [x] Preserve readable `body_text` for email/ntfy pings.
- [x] Add/adjust inline Vitest coverage.
- [x] Run focused tests.

Notes:
- `format_new_dictionary_notification` already links the dictionary; it should additionally link the creator.
- `format_new_user_notification` has the created user's id at both email and Google signup call sites.
- `format_invite_notification` has the inviter user id. The invite target may not have a user row yet, so only the inviter can be linked reliably for now.
- Verification:
  - `pnpm vitest run src/lib/server/chat/notification-messages.ts` passed: 1 file, 5 tests.
  - `pnpm check` passed: 0 errors, 34 existing warnings.
