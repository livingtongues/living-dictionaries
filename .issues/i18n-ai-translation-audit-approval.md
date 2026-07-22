# AI i18n audit — approved and applied

## Application receipt

Jacob approved sets A, C, and D in full and left set B for human specialists.

- Production backup: `r2/backups-rolling/db/living/2026-07-22T08-38-33Z.tar.zst`
- Translation corrections applied: **173** (156 original AI rows + 17 stale `en_changed` rows)
- English catalog fixes applied: **2** (`gl.seh` key repair and `ps.ideo` spelling)
- Specialist rows changed: **0/18**
- Independent final state: **7,517** active AI-review rows, **0** `en_changed` rows, **0** active
  translation gaps
- The 144 newly translated drafts remain in the AI-review queue. No locale seed refresh, commit, or
  push was performed.

## Outcome

| Result | Rows | Share of original AI queue |
| --- | ---: | ---: |
| High-confidence corrections recommended | 156 | 2.12% |
| Context-dependent specialist decisions | 18 | 0.24% |
| No substantive change recommended | 7,182 | 97.64% |
| **Original active AI queue audited** | **7,356** | **100%** |

The audit covered 1,193 English keys across all 18 locales. Every row was assessed by feature/key context with its locale variants together. Structural validation found zero empty values, brace errors, or placeholder mismatches.

## Approval set A — 156 high-confidence AI corrections

Recommendation: approve as one set. These are meaning, grammar, stale-source, interpolation, or domain errors—not preference-only rewrites.

| Feature section | Corrections | Main impact |
| --- | ---: | --- |
| Public/site UI | 22 | Removes the nonexistent editor role from all 18 translations; updates German “CSV/JSON” import copy; fixes three Hausa app/zoom mistranslations |
| Dictionary editing | 15 | Repairs broken German interpolation/filter fragments, a destructive Amharic warning that reverses what gets deleted, Hausa offline/sync meaning, and several concrete grammar/word-sense errors |
| Corpus/import | 74 | Corrects bibliographic citation vs quotation (30 rows), literal physical “follow up” (12), and 32 import/source-domain errors |
| Controlled vocabularies | 45 | Fixes POS labels/abbreviations, semantic hierarchy relations, part/whole grammar, and two German semantic-domain terms |
| **Total** | **156** | |

### High-confidence impact by locale

| Locale | Rows | Locale | Rows | Locale | Rows |
| --- | ---: | --- | ---: | --- | ---: |
| Amharic (`am`) | 11 | Arabic (`ar`) | 2 | Assamese (`as`) | 9 |
| Bengali (`bn`) | 6 | German (`de`) | 14 | Spanish (`es`) | 3 |
| French (`fr`) | 2 | Hausa (`ha`) | 17 | Hebrew (`he`) | 11 |
| Hindi (`hi`) | 6 | Indonesian (`id`) | 8 | Malay (`ms`) | 9 |
| Odia (`or`) | 6 | Portuguese (`pt`) | 4 | Russian (`ru`) | 6 |
| Swahili (`sw`) | 11 | Vietnamese (`vi`) | 25 | Chinese (`zh`) | 6 |

Exact current/proposed values and code context:

- [Public/site report](./i18n-audit-public-site.md)
- [Dictionary-editing report](./i18n-audit-dictionary-editing.md)
- [Corpus/import report](./i18n-audit-corpus-import.md)
- [Controlled-vocabulary report](./i18n-audit-controlled-vocabulary.md)

## Approval set B — 18 context-dependent rows

Recommendation: leave these for specialist/human translator judgment rather than applying automatically.

- 14 translations render narrative-role `discourse.reported_speech` specifically as *indirect speech*. That may be too narrow if the app intends the tag to include direct quotation.
- Hindi `discourse.flashback` currently uses a term that can mean preview/advance view; the proposed past-scene term is safer, but a literary translator may prefer the technical term.
- Swahili, Hausa, and Amharic `text_tag.motif` values currently mean descriptor/theme rather than a recurring folklore motif; the best specialist term needs confirmation.

The exact 18 proposals are separated under “Context-dependent terminology to confirm” in the [corpus/import report](./i18n-audit-corpus-import.md).

## Approval set C — 17 adjacent `en_changed` corrections

Recommendation: approve with set A.

These are not AI rows, so they are outside the 7,356 denominator. All 17 are non-German `about.import_data` translations still limited to CSV/JSON after English changed to “Import data from any format.” German is already included in set A because its stale value is AI-sourced. Exact values are in the [public/site report](./i18n-audit-public-site.md#additional-stale-source-corrections-en_changed-not-ai-audit-rows).

## Approval set D — two English catalog defects

Recommendation: fix both in code, with the key rename carried through production safely.

- `gl.seh ` contains a trailing space, so the German `Sena` translation is unreachable from the dynamic BCP-47 lookup `gl.seh`.
- `ps.ideo` misspells *onomatopoeia* as `onomatoepia` in English. Existing translated meanings remain valid.

Details are in the [controlled-vocabulary report](./i18n-audit-controlled-vocabulary.md#english-catalog-issues-found-while-checking-context).

## New strings — completed and staged

The eight new `import_page.*` strings were read in their exact call-site context and translated for all 18 locales: **144 values**. The complete matrix is in the [corpus/import report](./i18n-audit-corpus-import.md#new-import_page-drafts).

- Backup: `r2/backups-rolling/db/living/2026-07-22T08-21-29Z.tar.zst`
- Production insert: 144/144 rows, conflict-protected
- State: `source='ai'`, `needs_review='ai'`, `updated_by_name='AI (i18n audit 2026-07-22)'`
- Independent verification: 144/144 rows present and attributed, zero placeholder mismatches, zero remaining active translation gaps
- Production AI-review queue after staging: 7,500 rows (the audited 7,356 plus these 144 new drafts)

Sets A, C, and D have been applied. Set B remains untouched for specialist review. No locale seed
files were refreshed, committed, or pushed.
