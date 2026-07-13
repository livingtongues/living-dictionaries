# Follow-up: notify editors who got stuck on the seq-transition loop

**Cron job:** `c-2de834` — local-store one-time job on **mustang**, runs 2026-07-15 09:00.
`horse cron rm c-2de834` once the real send is done.

## Background (the bug + fix — already shipped)

A pre-2026-07-09 sync-cursor migration left some users with a stale local OPFS copy of a dict. On
every boot a racy `needs_seq_transition → rebuild → reset` teardown raced the entries-list read →
`SQLITE_MISUSE (21)` / "Failed to read dict bundle" / "initial dict sync failed" /
`leader_boot_failed` → the dict was **stuck on "Loading" forever** (editors especially; viewers got
SSR content and didn't notice). Full diagnosis in
`.issues/tutelo-stuck-loading-seq-transition-loop.md`.

**Fix (live in prod):** removed the racy teardown so an old-cursor file converges **in place** via
one full `/changes?since=null` pull. Commits `df7dec18` (fix) + `4ef49ffc` (docs). Verified: a plain
reload self-heals — Jacob confirmed tutelo-saponi loads for him 2026-07-13, and zero real-user stuck
signatures in the first hour post-deploy.

## What this follow-up session must do (cold start)

1. **Re-check telemetry (48h window)** to confirm the fix stayed quiet AND find who's STILL stuck.
   Query prod `logs.db` via the **check-logs** skill (`ssh living` → `docker exec -i sveltekit_blue
   node` < a temp `.js`, `/data/logs.db` readonly). Stuck signatures:
   `message LIKE '%dict bundle%' OR '%initial dict sync failed%' OR '%leader_boot_failed%' OR
   '%seq_cursor_transition%'`, `build_target='production'`.
   - Confirm these went ~silent for real users after the deploy (~2026-07-13 07:00Z).
   - The target recipients are editors who were genuinely looping (many sessions/events over several
     days) and **have NOT returned/self-healed since the deploy** (no clean session after 07-13).
     Resolve `user_id` → name/email/`unsubscribed_from_emails`/`preferred_locale` by joining
     `/data/shared.db` `users` (id, email, name, unsubscribed_from_emails, preferred_locale).

   Candidate stuck editors identified 2026-07-13 (30d window, `sessions>=3 OR events>=20`), EXCLUDING
   Jacob's own test account (`jwrunner7@gmail.com`):
   - 🔴 Eduardo A. Muñoz Espinoza — eduardoelheroe2005@gmail.com — 20 sessions / 87 events
   - 🔴 Boie' nen — alclaveria@gmail.com — 15 sessions / 80 events
   - 🟠 Senhaja — srairsenhaja@gmail.com — 254 events / 1 session (07-09)
   - 🟠 michelle M — michellem.8804@gmail.com — 5 sessions
   - 🟡 Matteo Ifergane — matteo.ifergane008@gmail.com — 3 sessions
   - 🟡 Carlos G. M. — carlosgonmir@gmail.com — 3 sessions
   - 🟡 Eeden — aaryne@fairfieldschools.net — 3 sessions

   Recompute fresh at run time; drop anyone who has since had a clean session (they already
   self-healed — no need to bother them). Skip anyone `unsubscribed_from_emails`.

   **EXCLUDE — Jacob already personally replied to these, do NOT email them:**
   - `misahenta-yesa@spectrum.net` (the reporting person)
   - `alclaveria@gmail.com` (Boie' nen — older issue, already resolved with Jacob directly)

2. **Draft a SHORT, WARM, GENERIC email** — Jacob's explicit instructions:
   - **Do NOT personalize / do NOT address anyone by name.** Recipients must not be able to tell
     whether it went to 2 people or 1000. No "Hi {name}", no dict name that only they'd recognize.
   - Tone: "Hey, we recently had a problem with such-and-such (a dictionary getting stuck on
     'Loading'), and it's now resolved — just reload and everything works, none of your work was
     lost. Thanks for your patience." Keep it brief and friendly.
   - Localize if it's easy (several recipients are Spanish/French speakers per `preferred_locale`),
     but a single clean English version is acceptable — Jacob decides at review.

3. **Send a COPY to Jacob FIRST for review** — send only to `jwrunner7@gmail.com` via the SES path
   (`$lib/email/send-email.ts`), then report to Jacob in the session with the proposed recipient list
   + the exact copy, and **WAIT for his approval/edits before sending to the real recipients.** Do
   NOT blast the recipients unprompted.

4. After Jacob approves and the real send goes out, note the outcome here, then remove the cron job
   with `horse cron rm <id>` (find the id via `horse cron list`).

## Notes
- Sending infra: AWS SES via `$lib/email/send-email.ts` (see the shared email conventions). Honor
  `unsubscribed_from_emails`.
- ntfy the findings when spawned; don't mutate/send to real recipients before Jacob replies.
