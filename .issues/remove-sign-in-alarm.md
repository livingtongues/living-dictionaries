# Remove the zero-logins sign-in alarm

Jacob, 2026-08-05: "completely remove the log-in alarm entirely, mechanism and mention of it. I
don't want to be notified about the log-in stuff."

Its first and only firing was a false positive — email one-time-code read zero on 2026-08-03 as a
substitution artifact, not a break — and Jacob does not want login notifications at all.

## Decisions (asked & answered)

- **Code:** remove the cron + the flatline rule everywhere. KEEP the `/admin/health` Sign-in panel,
  reduced to a plain "logins per method / new accounts" chart with no red verdict and no alarm copy.
- **Docs:** scrub the forward-looking docs. LEAVE the dated `.cron/log-reviews/2026-08-0X.md`
  nightly logs untouched — they are a historical record of those nights.
- **Prod chat:** hard `DELETE` the three rows (2 system + Jacob's reply), after a shared.db backup.

## Work

- ✅ Delete `site/src/lib/db/server/sign-in-alarm-cron.ts`; drop the `sign-in-alarm` entry + import
  from `crons.ts`.
- ✅ `log-analytics.ts`: drop `sign_in_flatlined`, `SIGN_IN_ACTIVE_DAYS_REQUIRED`,
  `SIGN_IN_BASELINE_DAYS`, and the `flatlined` / `active_days_before` / `daily_average_before` /
  `last_login_at` fields. `SignInHealth` is now `{ day, logins, new_accounts, methods: { method,
  logins }[], daily }` — a reporting shape with no judgement in it.
- ✅ `SignInPanel.svelte` — verdict line is neutral, alarm paragraph + `.danger` styling gone;
  stories reduced to Healthy / GoogleQuiet(→ removed) / NoLogins.
- ✅ `log-analytics.test.ts`, `mock-analytics.ts`, `insights.test.ts` updated to the new shape.
- ✅ Docs scrubbed: `.knowledge/admin/measuring-what-stopped.md` deleted + index entry,
  `.cron/log-reviews/decisions.md` rule, `.issues/nightly-2026-08-03-approved-items.md`,
  `.issues/future/dashboard-improvements.md` (LD + house planned port),
  `.issues/boot-error-reporter-report.md` reference.
- ✅ Prod: backup shared.db, hard-delete the 3 `chat_messages` rows, delete the
  `db_metadata.sign_in_alarm_state` row.

## Guards left behind (deliberate)

The alarm is mentioned in exactly three places now, each as a PROHIBITION so a nightly-review agent
doesn't re-file it: `.cron/log-reviews/decisions.md` (the 2026-08-03 standing law about acceptance
tests stays — it is about how you VERIFY a change — but now says explicitly that it is not a licence
to build login alarms), `.issues/future/dashboard-improvements.md` (LD) and house's copy of the same
file. `.cron/log-reviews/2026-08-03.md` / `2026-08-04.md` are untouched historical record.

## Prod state

- Backup: `/opt/hosting/data/shared.db.bak-20260805-144252` (214 MB, taken before the delete).
- Deleted 3 `chat_messages` rows + `db_metadata.sign_in_alarm_state`; `integrity_check` ok, no
  attachments/reactions/reply pointers referenced them (chat read state is timestamp-based, so no
  dangling pointers). Zero rows in chat mention sign-in now.
- **The DEPLOYED build still carries the cron** until this lands on `main` — it can only speak again
  if a method flatlines before then, and its state row is gone so it would start from clean.

## Verification

`pnpm test` (2631 passed), `tsc` clean, `pnpm lint` clean, `pnpm check` 0 errors, svelte-look
screenshots of the reduced panel in light + dark.
