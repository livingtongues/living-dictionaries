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

## 2026-07-15 follow-up session — findings

✅ **Telemetry re-check (48h + since-deploy window, prod `logs.db`):**
- `seq_cursor_transition` mentions since the 07-13 07:00Z deploy: **0** (the reason literally no
  longer exists in the bundle — confirms the specific rebuild-loop mechanism is gone).
- `leader_boot_failed` / `initial dict sync failed` / `Failed to read dict bundle` still fire
  post-deploy (871 events / 8 users / 86 sessions in the 48h window) but these are UNRELATED
  causes: deploy-time chunk-hash module-fetch failures ("Importing a module script failed"),
  `leader boot stalled` at `opfs_open`/`migrate` (a different, already-tracked issue —
  `.issues/dict-client-migration-idempotency.md`), and plain `Failed to fetch` network blips. None
  reference `seq_cursor_transition`.

✅ **Recomputed the candidate list fresh** (30d window, `sessions>=3 OR events>=20`, same heuristic
as the 07-13 snapshot) — got the same 8 people (7 named + Jacob's own `jwrunner7@gmail.com` test
account, which resolves to `f0fdbb2f-b87d-4717-8858-37e64efeb112` and is excluded). For each,
checked every session after the deploy for a "clean" one (no error/crash/dict-bundle-fail rows):

| user | pre-deploy signal | post-deploy sessions | self-healed? |
|---|---|---|---|
| Senhaja | 254 events/1 session | 1 | ✅ clean session found |
| Eduardo A. Muñoz Espinoza | 87 events/20 sessions | 24 | ✅ clean session found |
| Boie' nen (alclaveria@) | 80 events/15 sessions | 31 | ✅ clean (+ already excluded per Jacob) |
| michelle M | 6 events/5 sessions | 1 | ✅ clean session found |
| Matteo Ifergane | 3 events/3 sessions | 19 | ✅ clean session found |
| Eeden | 3 events/3 sessions | 3 | ✅ clean session found |
| **Carlos G. M.** | 4 events/3 sessions, last seen 07-10 16:42Z, exact `SQLITE_MISUSE(21)` "Failed to read dict bundle" on `nahuatl` (manages 13 dicts) | **0** | ❌ **never returned since the deploy** |

**Only Carlos G. M. (`carlosgonmir@gmail.com`) qualifies** — genuinely hit the bug (confirmed
MISUSE-21 dict-bundle failure on `nahuatl`, where he's a manager) and has not opened the site again
since 07-10, i.e. no chance yet to see it's fixed. `unsubscribed_from_emails` is null (ok to email),
`preferred_locale` is null (defaults to English).

✅ **Draft copy sent to Jacob only** (`jwrunner7@gmail.com`) via a raw SigV4-signed SES `SendEmail`
call run inside the prod `sveltekit_blue` container (reused its already-loaded `AWS_SES_*` env vars
— see `/tmp/ses-send.js`/`/tmp/ses-draft-send.js` this session, not committed anywhere). Subject
prefixed `[DRAFT for review]` so Jacob can tell it apart from the real send. From:
`Living Tongues Institute for Endangered Languages <no-reply@livingdictionaries.app>`, Reply-To
`support@livingdictionaries.app`.

✅ **Jacob approved as-is.** Real copy sent 2026-07-15 to `carlosgonmir@gmail.com` only (subject
`Fixed: dictionary stuck on "Loading"`, no `[DRAFT]` prefix) — SES `MessageId`
`010f019f6515aeee-cfe1c1d5-3674-46be-8a3d-2b996e1f53fa-000000`, HTTP 200. No other recipients
qualified (everyone else on the candidate list had already self-healed post-deploy — see table
above). Cron job `c-2de834` removed.

**Status: DONE.**
