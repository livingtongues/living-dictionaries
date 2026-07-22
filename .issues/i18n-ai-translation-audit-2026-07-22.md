# Audit AI i18n translations — 2026-07-22

Review every in-scope AI-translated production i18n row against its English source and the UI code context, propose linguistic improvements without changing production, and draft translations for all newly missing active keys across every translatable locale.

## Scope and decisions

- ✅ Read the database and `/fill-translations` workflow instructions.
- ✅ Confirmed the app currently defines 18 non-English translatable locales.
- ✅ Found the previous AI fill receipt: 36 keys × 18 locales = 648 rows staged for human review on 2026-07-20.
- ✅ Queried production read-only on 2026-07-22: 1,201 active English keys, 7,356 active translations with `source='ai'`, and every one of those rows still has `needs_review='ai'`. The pending/source-AI scopes therefore coincide today.
- ✅ Confirmed the new work is exactly eight active keys, missing in all 18 locales (144 translations), all under `import_page.*`.
- ✅ Jacob selected the full current 7,356-row review queue rather than only the latest 648-row fill.
- ✅ Jacob authorized staging the eight new-key drafts without a separate approval step; audited-row corrections remain proposal-only until approval.

## Audit plan

- ✅ Grouped the queue by key prefix and feature context. The audit is partitioned by section (never by language) so all locale variants are judged against one shared UI meaning.
- ✅ Public/site sections: `about`, `account`, `banner`, `contact`, `create`, `dict_home`, `dictionary`, `footer`, `header`, `home`, `home_v2`, `map`, `partnership`, `terms`.
- ✅ Dictionary editing sections: `audio`, `column`, `contributors`, `entry`, `entry_field`, `error`, `export`, `grammar`, `history`, `image`, `invite`, `misc`, `page`, `print`, `sense`, `settings`, `speakers`, `sync`, `upload`, `video`.
- ✅ Corpus/import sections: `discourse`, `import_page`, `sentence`, `source`, `text`, `text_tag` (including contextual drafting of the eight new `import_page.*` keys).
- ✅ Controlled-vocabulary sections: `gl`, `ps`, `psAbbrev`, `relationship_type`, `sd`.
- ✅ Mapped every target key to its call sites, visible UI situation, interpolation/pluralization constraints, and nearby terminology.
- ✅ Compared each translation with the English meaning, code context, locale register, existing human terminology, placeholders, punctuation, and script conventions.
- ✅ Assessed all 7,356 active AI-review rows across 1,193 keys and every call-site section.
- ✅ Drafted improvements only where warranted: 156 high-confidence row corrections, 18 specialist/context-dependent rows separated from the approval-ready set, and 7,182 rows with no substantive correction.
- ✅ Drafted every missing active key for all 18 locales: a complete 144-value matrix (18 locale rows × 8 keys), with call-site-specific treatment of the delete-confirm fragment and accessible-label strings.
- ✅ With Jacob's explicit authorization to do the new drafts without another approval step, created a WAL-safe backup at `r2/backups-rolling/db/living/2026-07-22T08-21-29Z.tar.zst`, then inserted all 144 rows into production with conflict protection, `source='ai'`, `needs_review='ai'`, and `updated_by_name='AI (i18n audit 2026-07-22)'`.
- ✅ Independent post-write query at 2026-07-22T08:24:23Z: 144/144 staged and attributed rows, zero placeholder mismatches, zero remaining active translation gaps, and the AI-review queue is now 7,500 rows (the audited 7,356 plus the new 144).
- ✅ Produced `.issues/i18n-ai-translation-audit-approval.md` with approval sets, impact by feature and locale, links to every exact current/proposed value, the separate specialist queue, the adjacent `en_changed` queue, source-catalog defects, and the staged-new-drafts receipt.
- ✅ Jacob approved all 156 high-confidence AI corrections, all 17 adjacent `en_changed`
  corrections, and both English catalog fixes; the 18 context-dependent rows remain assigned to
  human specialists.
- ✅ Took a fresh pre-write production backup containing the previously staged 144 drafts:
  `r2/backups-rolling/db/living/2026-07-22T08-38-33Z.tar.zst`.
- ✅ Applied the 173 approved translation changes in one guarded transaction. The corrected values
  remain `source='ai'` / `needs_review='ai'` so translators can review them; the 17 stale-source rows
  moved from `en_changed` into that AI-review queue.
- ✅ Renamed the production catalog key `gl.seh ` to active `gl.seh`, preserving all 18 locale rows
  byte-for-byte, and corrected the `ps.ideo` English spelling. The same two English source fixes are
  present in the working tree.
- ✅ Independent read-only verification confirmed all 173 approved values, all 18 specialist values
  unchanged, 18/18 translations preserved for each catalog fix, zero `en_changed` rows, zero active
  translation gaps, and an active AI-review queue of 7,517.
- ✅ Verified the public production `/api/i18n/export` now emits corrected values, includes `gl.seh`,
  and excludes the old `gl.seh ` key. Focused i18n tests pass (7 files / 27 tests), `pnpm check`
  reports 0 errors, both edited English JSON files parse, and `git diff --check` passes.
- ℹ️ The two English source-file fixes are intentionally uncommitted. They must be included in the
  next normal deploy so a future server boot continues to mirror the corrected catalog; non-English
  seed files were not refreshed because production DB/export remains their source for deploy baking.

## Verification

- ✅ Global structural scan of all 7,356 rows: zero empty values, zero brace imbalance, and zero placeholder-set mismatches. The 13 numeric differences are legitimate localized digits or spelled-out numbers; the two trailing-space values intentionally mirror an English fragment concatenated with a date.
- ✅ Queried AI rows older than their English source: exactly 19 stale rows across two keys (`about.import_data` in German and `home_v2.feature_collaboration_body` in all locales); the context audit identified corrections for all 19.
- ✅ Corrected a reviewer query that had accidentally included soft-removed `home.main_banner`; the active-only section totals sum exactly to 7,356.
- ✅ Pre-write production re-query at 2026-07-22T08:19:51Z: still 7,356 AI-review rows / 1,193 keys and exactly the same eight missing keys × 18 locales = 144 gaps.
- ✅ Final query also found 17 `en_changed` non-AI rows, all stale CSV/JSON-only translations of the newly broadened `about.import_data`; drafting these as a separate adjacent finding rather than mixing them into the requested AI count.
- ✅ Validated all suggested/new values for placeholder preservation and complete locale/key coverage.
