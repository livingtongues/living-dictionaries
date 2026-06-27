# Legal pages live + /admin/legal-review tab; Anna off-duty

Two follow-ups from the 2026-06-27 tidy conversation. **All code shipped + verified (627 tests,
check 0 errors, lint clean, svelte-look screenshot of the review page). Awaiting Jacob's review +
the go-ahead to commit.**

## A. Anna off-duty ✅
- ✅ `admins.ts`: `notify?: boolean` on `Admin` (absent = on duty). Anna `notify: false`.
- ✅ `agent/triage/routing.ts`: `account: JACOB` (was Anna); dropped `ANNA` const; test updated +
      a new "no category routes to an off-duty admin" guard test. `apply-triage.ts` test updated.
- ✅ `notifications/notify-admins.ts`: broadcast `notify_admins` filters `notify !== false`.
- ✅ `db/server/chat-reping-cron.ts`: skips members whose admin has `notify === false`.
- ✅ Knowledge: `admin/admin-backend.md` + `admin/ai-triage-pipeline.md` updated (off-duty concept +
      account→Jacob; also corrected the stale "AI triage NOT ported" line — it WAS built).

## B. Legal pages live ✅
- ✅ `terms-of-use.md`: privacy link → `/privacy-policy` (was external livingtongues.org WP).
- ✅ `/privacy-policy` linked from the **footer** (`shell/Footer.svelte`) + **side menu**
      (`[dictionaryId]/SideMenu.svelte`).
- ✅ AGENTS.md route list updated (`/privacy-policy` + admin `legal-review`).

## C. /admin/legal-review page ✅
- ✅ Before snapshots: `lib/legal/before/terms-before.md` (old Termly terms converted from git) +
      `privacy-before.md` (note: none existed → diffs as all-new).
- ✅ `components/legal-review/legal-diff.ts` — paragraph-block LCS diff (immune to re-wrapping) +
      6 inline tests.
- ✅ `routes/admin/legal-review/+page.svelte` — side-by-side Before|After, **changes in yellow**,
      rendered via `marked`; changed-passage count + links to the published pages. Admin-nav link
      added (Greg is an admin → reachable). Screenshot-verified.

## Remaining (Jacob)
- Review `/admin/legal-review` + the live footer/side-menu links on staging; then say the word to commit.
- (legal-pages-rewrite.md) hand `legal-pages-proposal.md` to Anna/Greg; confirm the age-13+ change.
