# Requested import resource management

Managers need to be able to dismiss the post-request success banner, edit metadata on resources
that have already been requested, and permanently delete requested resources with confirmation.
Post-request changes must reach the team as follow-up messages rather than silently changing the
resource behind the original import request.

## Production verification

- ✅ Test file `f1267d1a-3120-449f-b49d-575565906257` is confirmed in `shared.db` for
  `wenshanhua`, storage key `import/wenshanhua/f1267d1a-3120-449f-b49d-575565906257`.
- ✅ R2 `HeadObject` independently reports `image/jpeg`, 6,840,413 bytes, last modified
  `2026-07-21T02:33:46Z`; size and MIME match the DB row exactly.
- ✅ The request belongs to message thread `e8d2efbd-ff17-4ebd-9757-c0c17a72575f`. The dictionary
  row and thread URL both correctly identify `wenshanhua`.
- ✅ Production now has every unresolved import-request thread assigned to Jacob. One Iipay thread
  still assigned to Diego was reassigned directly; the Wenshanhua test thread had already been
  reassigned to Jacob.

## Code findings

- `ImportFileCard.svelte` already has edit/delete actions for pending files, but deliberately renders
  requested files read-only and hides the trash action.
- The v1 PATCH endpoint already supports `filename`, `import_instructions`, `source_note`, and
  `source_id` after a request, but it only changes `source_files`; it does not append a thread message
  or notify the assignee.
- The v1 DELETE endpoint deletes both the DB row and R2 bytes, but currently blocks requested files
  for non-admins. The original import-request message preserves the old metadata even if the row is
  later removed.
- Before this work, import requests reused content routing and therefore went to Diego. They now
  have a dedicated Jacob route; follow-ups notify whoever currently owns the thread.
- The admin message copy payload shows `(unknown url)` when the local admin catalog has not resolved
  the thread's dictionary row, even though `message_threads.url` already contains the correct URL.
  It should fall back to parsing the stored thread URL.
- `ImportFileCard.stories.ts` already provides pending/ready/requested visual fixtures, giving this
  work a direct light/dark svelte-look feedback loop. Authenticated browser verification is available
  through the dev OTP flow.

## Planned work

- ✅ Add dismiss X to the success bar.
- ✅ Add requested-card edit mode with explicit save/cancel and one batched PATCH.
- ✅ Append a customer-authored follow-up message for requested metadata changes and notify the
      chosen recipient through their configured channel.
- ✅ Allow confirmed requested-resource deletion after a destructive confirm, append a removal
      message, reopen the thread, and notify its assignee.
- ✅ Preserve human/agent v1 API parity and add endpoint tests for auth, message, notification, DB,
      and R2 behavior.
- ✅ Fix the admin copy-payload dictionary URL fallback.
- ✅ Add/update English i18n keys only.
- ✅ Add requested edit/delete stories and verify light/dark screenshots.
- ✅ Run focused tests, full tests, lint, check, Svelte analysis, production build, light/dark visual
      stories, and an authenticated browser flow.

## Product decisions

- ✅ Requested-resource metadata includes import instructions and source note; filename is not
  editable. The original overall request note must also be editable.
- ✅ Requested cards use an explicit inline Edit → Save changes / Cancel flow. One save produces one
  batched PATCH and one follow-up message, never per-field blur notifications.
- ✅ Follow-ups append to the original import thread, mark it unread, and reopen it if resolved.
- ✅ Notifications follow the thread's current assignee. New import requests route specifically to
  Jacob (other content/partnership routing remains unchanged), and every existing unresolved import
  request is reassigned to Jacob.
- ✅ Deleting a requested resource permanently removes its R2 bytes + `source_files` row, preserves
  the original message history, appends a removal message, and notifies the assignee.
- ✅ Post-request edit/delete is uploader-only, with a site-admin override. Pre-request manager
  collaboration remains unchanged.
- ✅ The overall request note is shown and edited once per import request group.
- Before this work, the overall request note was stored only inside the original message prose.
  Because one request can cover multiple resources, it now has an explicit thread-level source of
  truth and a once-per-batch editing surface rather than being copied onto every file.

## Implementation notes

- Added `message_threads.import_request_note` and a migration that recovers the note from existing
  import-request message bodies. New requests store it directly while keeping the original message
  unchanged as history.
- `GET …/files` now returns request-group summaries plus caller-specific management permissions.
- Requested file PATCH/DELETE and request-note PATCH share owner/admin checks and follow-up logic.
  Each real change appends one customer-authored message, clears read/replied/resolved state, and
  notifies the thread's current assignee. No-op PATCHes do not create duplicate messages.
- Deletion removes storage bytes before committing the DB/thread mutation. Production uses R2
  `DeleteObject`; development removes `<DATA_DIR>/dev-media/{storage_key}`. A storage failure now
  fails the request and preserves both the source-file row and original thread unchanged, so a 200
  response guarantees the bytes are gone rather than silently orphaned.
- New import requests use a dedicated Jacob route; the existing Diego content/partnership triage
  routes are unchanged.
- Focused endpoint/OpenAPI/upload tests pass; disk/R2 deletion success and failure paths are covered;
  `pnpm check`, ESLint, and Svelte component
  analysis pass. The full Vitest suite and production build pass. Light/dark svelte-look screenshots
  were inspected for read and edit states.
- An authenticated browser flow completed upload → request → dismiss → request-note edit → batched
  instructions/source edit → confirmed deletion with zero page errors. SQLite independently showed
  the immutable original plus exactly three follow-ups, Jacob assignment, reopened/unread state, and
  no remaining file row. Temporary browser-test data was removed afterward.
- The migration was run against a synthetic pre-migration message and recovered exactly
  `Looks good to me`, matching the production test request's note format.
