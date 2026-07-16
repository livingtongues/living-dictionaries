---
every: 0 22 * * 1
runs_on: mustang
provider: claude
model: claude-opus-4-8
notify: poly_pings
---

Run the LD fill-translations pass by executing this repo's playbook end to end:
`.claude/commands/fill-translations.md` in ~/code/living-dictionaries.

That command is the skill LD already uses for this task (hand-run 4× in the 12 days before this
was scheduled). It: (0) backs up the prod `shared.db` if today's cron backup hasn't run, (1)
queries the missing active-key × `TRANSLATABLE_LOCALES` gaps + the `en_changed` review queue on
the living VPS, (2) AI-fills the missing values per-locale (flagged `source='ai'`,
`needs_review='ai'` for human review on /translate), (3) triages `en_changed` flags per Jacob's
policy, (4) `pnpm i18n:refresh` to pull prod values into the committed seed files, verifies the
diff is sane, runs the i18n `pnpm test` suites, then commits `i18n: AI translation fill
YYYY-MM-DD` and pushes to `main` (which deploys + bakes the seed), and (5) reports per-locale
counts filled / en_changed cleared vs re-flagged / anything skipped.

Follow that command exactly — it holds the full context, prod-access pattern, and safety rules.
When done, report the step-5 summary in this session and remind Jacob the "Notify translators"
button on /translate is now safe to press. If prod is unreachable or the diff looks wrong, STOP
and report rather than pushing.
