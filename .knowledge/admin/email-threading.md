# Inbound email threading + reopen/notify (LD ⇄ house)

Non-obvious runtime behaviors behind `find_or_create_thread` + the inbound handler
(`routes/api/messages/email-inbound/+server.ts`). LD and house are near-identical here — fix both.

## SES overrides our `Message-ID` header

We stamp outbound mail with `Message-ID: <uuid@livingdictionaries.app>` (house: `@hvsb.app`) and
persist it on `messages.message_id` so a reply's `In-Reply-To` can header-match it. **SES silently
replaces that header with its own** `<{SES MessageId}@{region}.amazonses.com>` — so the recipient's
client threads on the SES id, their reply references the SES id, and our stored uuid **never
matches**. Confirmed from a real reply: `In-Reply-To: <010f…-000000@us-east-2.amazonses.com>` while
we'd stored `<…@livingdictionaries.app>`. Header threading therefore silently fell through to the
**subject heuristic** (fallback #2: same `from_email` + normalized subject within 90 days) — fragile
(breaks on edited subjects, >90 days, shared subjects).

**Fix (2026-07-22):** `send_raw_email` now returns `provider_message_id` =
`build_ses_message_id({ ses_message_id: response.MessageId, region: AWS_SES_REGION })`
(`<id@{region}.amazonses.com>`; `us-east-1` uses the legacy `email.amazonses.com`). The reply +
compose endpoints overwrite `messages.message_id` with it on a successful send. Guarded on presence,
so dry-run/dev (and test mocks that return only `ses_message_id`) keep the generated uuid. If SES
ever honors our custom id instead, header match just falls back to the subject heuristic — no
regression. The uuid was never externally visible (SES discarded it), so overwriting loses nothing.

## A customer reply must RE-OPEN a resolved thread

The inbox lists `WHERE resolved_at IS NULL`. The inbound handler's reply branch must clear
`resolved_at` / `resolved_by_user_id` / `replied_at` / `replied_by_user_id` / `read_at` — otherwise
a reply to a resolved thread bumps `last_message_at` but stays in the *Resolved* bucket, invisible,
and the customer's reply is silently lost. **house had this; LD did not** until 2026-07-22 (LD's own
compose endpoint even documented "a customer reply re-opens any resolved thread regardless" — the
reopen was just never implemented in LD's inbound handler). This was the root cause of the
"went into the ether" incident. Server-side `UPDATE message_threads` propagates to admin clients via
the sync engine's `server_seq` — no manual `dirty` flag needed (same as compose/reply).

## Notification precedence on inbound

Ping the thread's **current assignee** first (targeted, honoring their `notify_channel`), so a reply
to a thread assigned to you always reaches you — then the directed-alias admin, then a team
broadcast. `notify_admins` (broadcast) now **honors each admin's channel** too (delegates to
`notify_admin`); it used to be ntfy-only, so the email-channel admins (Diego/Greg/Cailie) silently
missed every broadcast. In house, a reply on an already-assigned thread also **skips re-triage**
(it's already classified) and pings the assignee immediately regardless of the trusted-sender
spam-gate (a reopened thread carries no spam risk).
