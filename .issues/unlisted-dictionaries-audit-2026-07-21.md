# Audit unlisted dictionaries for junk and constructed languages

Read-only production audit requested 2026-07-21. Review every dictionary currently bucketed
`unlisted` and identify likely junk, test/crypto/spam projects, constructed languages, and uncertain
candidates that merit human review.

## Plan and progress

- ✅ Confirm the current meaning of `bucket = 'unlisted'` and read the prior bucket-classification record.
- ✅ Pull the complete current production `unlisted` catalog set and relevant activity/membership metadata.
- ✅ Inspect per-dictionary content statistics and representative entries for suspicious candidates.
- ✅ Cross-check names/descriptions/language identifiers and classify findings by confidence/reason.
- ✅ Deliver a concise list with dictionary URLs/IDs and evidence; make no production changes.

## Notes

- Prior classification was completed 2026-07-04; at that time 396 of 2,232 dictionaries were
  bucketed `unlisted`. This audit specifically looks for false negatives in that bucket.
- `unlisted` is intended for real, URL-reachable dictionaries Living Dictionaries serves; known
  conlangs and glossaries have dedicated buckets, and disposable junk belongs in `delete`.

## Audit result

The live set contains **408** unlisted dictionaries. All 408 per-dictionary databases were scanned
for crypto/blockchain/NFT and constructed/fictional-language signals; suspicious names and catalog
metadata were then checked against representative entries, senses, media counts, provenance, and
recent activity. No actual crypto, NFT, blockchain, or Web3 dictionary was found. Matches for
`token` were ordinary lexical uses.

### Clear bucket mistakes

| ID | Current content | Finding | Likely bucket |
|---|---:|---|---|
| `fino-takmori` | 209 entries, 206 sentences, 29 audio, 185 photos | The description says the project creates neologisms and borrowings, modernizes grammar/spelling, and hopes to become its own language branch. This was incorrectly rescued to `unlisted` in the July hand-review. | `conlang` |
| `fino-chamolli` | 45 entries, 3 sentences, 29 audio, 36 photos | Its own About page calls Fino' Chamolli more akin to an artificial language and documents deliberately introduced vocabulary/structural changes. | `conlang` |
| `vegetable-valley-allean` | 5 entries, 1 sentence, 5 audio | Fictional “raceworld”/“Vegie Language” project; entries are invented Cyrillic-form words for hello and one through four. | `conlang` |
| `papish` | 1 entry | A single-family idiolect made from one grandfather's creative phrases (“My near” = “Almost”), explicitly for the immediate/extended family. Fits the existing friend-group/personal-language treatment. | `conlang` |
| `mydictionaries` | 1 entry | Generic abandoned shell: the only headword is “Dictionary”, with no gloss or definition. | `delete` |
| `korea` | 2 entries | Catalog says Korean, but both entries are Mandarin Chinese (`你好`, `吃饭了吗`); appears to be a broken experiment rather than a Korean dictionary. | `delete` or `glossary` pending human intent |
| `deutsch10102024` | 11 entries | Personal German learner wordlist created by a non-community learner; entries have no glosses or definitions and were last edited 2024-10-10. Not junk, but it matches the existing learner-list definition of `glossary`. | `glossary` |

### Intentional test/sandbox dictionaries worth reviewing separately

- `chol` — Ch'ol (prueba), 9 entries
- `chuj-mexico` — Chuj (prueba), empty
- `tseltal-mexico` — Tseltal (prueba), 40 entries
- `tsotsil-mexico` — Tsotsil (prueba), 30 entries
- `sugtstun-test` — Sugt'stun (Test), 1 substantial entry; deliberately retained because code
  references it in `DICTIONARIES_WITH_VARIANTS`

The four `prueba` projects have legitimate Rising Voices/ELDP Mayan-language workshop provenance,
so they are sandboxes rather than junk. `miskito-dictionary-sample` was also checked: despite the
name it is an active, legitimate family/community-sourced Miskitu project (10 entries, 2 audio), not
a throwaway demo.

### Content anomaly in an otherwise legitimate dictionary

`pesh` / Pech is a valuable real-language project (3,038 entries), but entry
`rQOo37nhATaL1dNiZ7GJ` (`warku ñahta`, “depraved”) contains a long copied *Blue Velvet* character
plot in its notes, including explicit sexual-violence text. The dictionary should remain unlisted;
that one note merits editorial cleanup.

### Suspicious-looking names cleared by evidence

- `rusitene`: real Roseto Capo Spulico heritage variety, 4,728 entries + 3,779 sentences.
- `robinia`: attested extinct Baja California language (`robi1235`), 177 sourced entries.
- `lutrai`: attested Loterāʾi/Lutrāʾi Jewish-Iranian jargon/variety; 33 heritage entries.
- `official-yesañ-language` / `yésah-language`: Eastern Siouan/Tutelo-Saponi community revival,
  not constructed languages.
- `gosavi`: only one entry so far, but Gosavi is an attested Indian nomadic community/language
  variety; evidence is insufficient to call it junk.
- `kalipona` / `kaliponam`: empty, but both identify the historical Kalinago language (`crb`), not
  Toki Pona-derived conlangs.

No production buckets or content were changed during this audit.

## Group-chat follow-up

Requested 2026-07-21: post the findings from “Clear conlangs or personal invented languages”
through the `sugtstun-test` row into the `diego-greg-jacob` room as **System**, retaining every
dictionary link and adding links for all test dictionaries. State that Jacob has since moved each
dictionary into `conlang`, `glossary`, `delete`, or `unlisted` as appropriate, and that there is no
test-dictionary plan yet; the future preference is a shared sandbox that removes the need to create
test dictionaries.

- ✅ Resolve the production room, members, Jacob's skip-notification user ID, and current buckets.
- 🔄 Show Jacob the resolved recipients and obtain the required final approval before writing.
- ⬜ Queue one `chat_system_outbox` row and confirm the cron delivers it without error.

Resolved destination: room `diego-greg-jacob`, channel name “Greg, Jacob, Diego, Cailie”. Members
are Greg (`livingtongues@gmail.com`), Cailie (`ck1105@georgetown.edu`), Diego
(`diego@livingtongues.org`), and Jacob (`jwrunner7@gmail.com`). The outbox row will skip Jacob's user
ID so the other three members receive the normal notification.

Current catalog state was verified before drafting: the conlangs/glossaries/deletes Jacob selected
are present. `chol`, `tseltal-mexico`, and `tsotsil-mexico` are URL-unlisted (`public = 0`) but their
newer `bucket` column remains NULL, so the message will use the user-facing “unlisted” wording and
will not claim that those three carry an explicit `bucket = 'unlisted'` value.
