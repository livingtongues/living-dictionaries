# Import follow-ups — what's still open across the five completed imports

Consolidated 2026-07-31. The five production imports (enxet, eastern-pomo, iipay-aa, catawba,
ponca) are ALL complete and verified; their full run records (working files, ledgers, backups,
lane structure) live in git history under `.issues/{dict}-import.md`, `.issues/ponca-*.md`,
`.issues/import-conversations.md`. Working dirs remain at `~/import-work/{dict}/` on mustang.

## Open items

- [ ] **Ponca — waiting on Greg.** Thread `523ba8fe` has the report artifact, 1 message, and
      3 open `thread_questions`. Unresolved until he answers; nothing for us to do meanwhile.
      Admin-facing process report ready to send: `/home/jacob/reports/ponca-import-process.html`
      (mustang).
- [ ] **Catawba — closing reply awaiting Jacob's send** (draft at the bottom of the old
      `catawba-import.md`, git history). Also confirm the API key from
      `~/import-work/catawba/token.private` was revoked.
- [ ] **Eastern Pomo — Jacob clicks Resolve** at `/admin/imports` (jcirelli can keep posting;
      nothing locks). Horse cron `c-660936` (2026-08-25) revisits the 139
      `sentence-row-recategorize` entries + the review queue.
- [ ] **Iipay Aa — confirm key `d0138c88-…` revoked.** (The corrupted-OPFS contributor from this
      dictionary is tracked in `.issues/dict-boot-persistent-opfs-recovery.md`.)
- Enxet: no open items here — its two API gaps live in
  `.issues/api-entry-patch-bulk-and-clear-semantics.md`.

## Related open issues

- `.issues/admin-api-key.md` — an admin-scoped key would remove per-dict key minting from Phase 0.
- Guide rationale (why each importing.md rule exists) moved to
  `.knowledge/domain/import-guide-rationale.md`.
