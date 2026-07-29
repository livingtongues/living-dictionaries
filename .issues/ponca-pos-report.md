# Ponca POS standardization — dry-run report

Lane 3 of `.issues/ponca-grammar-round-2.md`. Everything below **except part 0 is a
proposal** — nothing in parts 1–3 has been written to production. Jacob reviews, then a
follow-up session applies.

All numbers are measured on **production** `/data/dictionaries/ponca.db`, 2026-07-29
(5,257 entries · 5,617 senses · 4,999 senses carrying a part of speech).

---

## 0. Typo-variant merges — ✅ APPLIED to production

The only piece Jacob pre-approved for direct apply. Four stray misspellings, each merged
onto the spelling the rest of the data already used — no mapping judgement involved.

| entry | gloss | before | after |
|---|---|---|---|
| Iđáhąbđè | dreamed | `v`, `past. t.` | `v`, `past t.` |
| Uą́ʼđįgè | for no reason | `prep phr.` | `prep. phr.` |
| Úđitʼą̀ | work | `n`, `3rd pers sing.` | `n`, `3rd pers. sing.` |
| Wamą́skèʼnásagè | saltine crackers | `n`, `s./pl.` | `n`, `sing./pl.` |

Runbook followed (same shape as the 2026-07-28 de-CAPS pass):

- **Backup first** — zero-downtime online backup of `shared.db` + all 1,413 per-dict DBs →
  `r2/backups-rolling/db/living/2026-07-29T02-06-44Z.tar.zst` (244 MiB).
- **Scoped attributed key** — `api_keys` row `8f723026-3383-4772-ad2b-eabbf032253a`,
  `dictionary_id='ponca'`, `role='write'`, label **"Ponca POS typo merge 2026-07-29"**,
  `created_by_user_id` = `jwrunner7@gmail.com` (`f0fdbb2f-…`).
- **Writes via the v1 API** — `PATCH /api/v1/dictionaries/ponca/entries/{entryId}` with
  `{ senses: [{ id, parts_of_speech }] }` (POS arrays REPLACE on patch). 4/4 succeeded.
- **Read-back verify** — `past. t.` 0 senses / `past t.` 22; `prep phr.` 0 / `prep. phr.` 13;
  `3rd pers sing.` 0 / `3rd pers. sing.` 11; `s./pl.` 0 / `sing./pl.` 3.
  Distinct POS values **48 → 44**.
- **History attribution** — `ponca.history.db` holds exactly 4 `changes` rows for that key,
  4 distinct sense ids, `op='update'`, `user_id` = Jacob, deltas confined to
  `parts_of_speech`. `integrity_check` `ok` on both `ponca.db` and `ponca.history.db`.
- **Key revoked** at `2026-07-29T02:12:33.389Z`; no live `ponca` keys remain.

Script: `scripts/ponca/pos-typo-merge.cjs` (`--dry` / `--apply --key=` / `--verify`).

> Browsers pick this up on the next R2 snapshot rebuild (~30 min), not by live sync.

---

## 1. The POS vocabulary after the merges — 44 distinct values

Bucketed against the site's official list (`site/src/lib/mappings/parts-of-speech.ts`, 95
abbrevs). Standard values render as their full English name ("noun", "verb"); anything
unrecognized renders **verbatim** (`translate_part_of_speech` falls back to the raw string,
and `ModalEditableArray` seeds an unknown value as its own option, so a manager opening the
POS editor does not silently lose it).

### 1a. Already standard — leave alone (21 values, 5,208 POS slots)

`n` 2492 · `v` 1508 · `adj` 682 · `adv` 228 · `pro` 69 · `prep` 45 · `int` 33 · `vt` 32 ·
`vp` 27 · `suff` 20 · `pref` 15 · `conj` 15 · `art` 11 · `vi` 8 · `np` 7 · `adv.p` 4 ·
`v.aux` 4 · `ap` 3 · `poss` 2 · `n.suff` 2 · `pers` 1 · (`pl` 5 — see 2c)

### 1b. Custom values that need a decision (see part 2)

`prep. phr.` 13 · `pl. pron.` 7 · `pron. phr.` 1 · `n./prep. phr.` 1 · `adv. suffix` 1 ·
`v. past t.` 1 · `pl./emphatic` 1

### 1c. Person / number / tense pseudo-POS → morphology (see part 3)

`past t.` 22 · `1st pers. sing.` 21 · `2nd pers. sing.` 11 · `3rd pers. sing.` 11 ·
`1st pers. pl.` 11 · `past part.` 5 · `3rd pers. pl.` 5 · `pl` 5 · `sing.` 4 ·
`pres./past t.` 4 · `3rd pers. sing./pl.` 4 · `sing./pl.` 3 · `2nd pers. pl.` 3 ·
`3rd pers.` 2 · `pres. t.` 1 · `1st pers.` 1

---

## 2. Custom → standard mappings (proposed, NOT applied)

The book's abbreviations were built for a printed page with a key at the front. With the key
table dropped from the grammar (part 4), anything that can't become a standard abbrev should
be **written out in full** so it reads correctly with no key.

### 2a. Straight remaps — recommended

| current | senses | proposed | why |
|---|---|---|---|
| `prep. phr.` | 13 | **`prepositional phrase`** (written out) | No standard equivalent — the official list has `np`/`vp`/`ap`/`adv.p` but no prepositional phrase, and `phr` alone loses the head. Renders verbatim, reads fine next to "noun". |
| `pron. phr.` | 1 | **`pronoun phrase`** (written out) | Same reasoning. Ągúštʼì "we too". |
| `n./prep. phr.` | 1 | **`n`, `prepositional phrase`** | It was always two labels crammed into one string. Ášiáđa "without concern". |
| `adv. suffix` | 1 | **`adv`, `suff`** | Both standard. `-čábe` "very". (The list has `v.suff`/`n.suff` but no `adv.suff`.) |
| `v. past t.` | 1 | **`v`** + morphology `PST.PTCP` | A missing space, not a category: the sense is `["v. past t.", "past part."]` on Ađį́ áti. |

### 2b. Judgement calls — need Jacob

| current | senses | option A (recommended) | option B |
|---|---|---|---|
| `pl. pron.` | 7 | POS **`pro`** + morphology **`PL`** — "plural" is number, not a part of speech | POS `pro`, drop the plural marking entirely |
| `pl./emphatic` | 1 | POS **`poss`** (possessive pronoun) + morphology **`PL.EMPH`** — wíwítʼa "they are mine" is a possessive, and the legend's `EMPH` is exactly the book's Eʼ-/Eiʼ- emphatic | POS `v` + morphology `PL.EMPH` (what the mechanical rule produces, and it's wrong) |
| `past part.` | 5 | keep the real POS (`v` on all 5) + morphology **`PST.PTCP`** (already a legend code) | switch POS to the standard `pple` (participle) and drop the code |

The 4 `pl. pron.` demonstratives in that group (Duáđąkà/Duáte "these", Šéđąkà "those") are
arguably `dem` + `PL` rather than `pro` + `PL` — flagging because the legend already carries
a `DEM.PL` code. Recommend leaving them as `pro` for now; re-categorizing demonstratives is a
bigger content call than this cleanup.

### 2c. `pl` (5 senses) — a real fork

`pl` **is** on the official list ("plural"), so it is technically already standard. But it is
number, not a part of speech, and it appears only as a second label: `["vt","pl"]`,
`["n","pl"]`, `["v","pl"]`. **Recommend treating it like `sing.`** — move to morphology `PL`,
leave the real POS. Otherwise Ponca ends up marking plurality two different ways (`pl` on some
senses, `PL` in morphology on others). The counts in part 3 assume the move.

---

## 3. Person / tense → `entries.morphology` as Leipzig codes (proposed, NOT applied)

### 3a. Scope

**110 senses across 105 entries** (the issue estimated ~97; the difference is `pl`/`sing.`/
`sing./pl.`, which the estimate didn't count). **0 of 5,257 entries currently have any
`morphology` value**, so every write is a clean fill — nothing is overwritten.

### 3b. Value → code map

| book label | code | in legend? |
|---|---|---|
| `1st pers. sing.` | `1SG` | ✅ |
| `2nd pers. sing.` | `2SG` | ✅ |
| `3rd pers. sing.` | `3SG` | ✅ |
| `1st pers. pl.` | `1PL` | ✅ |
| `2nd pers. pl.` | `2PL` | ✅ |
| `3rd pers. pl.` | `3PL` | ✅ |
| `3rd pers.` | `3` | ✅ |
| `1st pers.` | `1` | ❌ **needs adding** |
| `3rd pers. sing./pl.` | `3SG/3PL` | ✅ (composite of two legend codes) |
| `sing.` | `SG` | ✅ |
| `pl` / `pl.` | `PL` | ✅ |
| `sing./pl.` | `SG/PL` | ✅ (composite) |
| `past t.` | `PST` | ✅ |
| `pres. t.` | `PRS` | ✅ |
| `pres./past t.` | `PRS/PST` | ✅ (composite) |
| `past part.` | `PST.PTCP` | ✅ |
| `pl./emphatic` | `PL.EMPH` | ✅ (composite) |

**Only one legend row to add**: `1` = "first person" (`category: 'person and number'`), used
by exactly one sense (Wamą́ʼ "sang", `["v","1st pers.","past t."]` → `1.PST`). Recommend adding
**`2` = "second person"** at the same time for symmetry with the existing `3`, even though
nothing uses it yet — a reader looking at the legend will otherwise wonder why `3` is alone.

### 3c. Ordering convention — one thing to confirm

Composed strings use **person/number first, then tense**: `1PL.PST`, `1SG.PST`, `2SG.PRS`,
`3SG.PRS/PST` — i.e. Jacob's example in the issue.

⚠️ The dictionary's own legend uses the **opposite** order in its portmanteau codes:
`PST.PRF.1SG`, `PST.PRF.2PL`, `FUT.1SG`, `PRF.1SG` (tense first, person last). Those are
codes for single Ponca morphemes (mikè, nąkà…), which is a different thing from our composed
descriptor, so I don't think they conflict — but if consistency matters more, the alternative
is `PST.1PL` / `PST.1SG` / `PRS.2SG` throughout. **Recommend keeping `1PL.PST`** (Jacob's
call in the issue, and the more common Leipzig reading order).

Rendering: `build_gloss_splitter` does longest-first **substring** matching, so `1PL.PST`
lights up as two small-caps codes with a plain `.` between them, `3SG/3PL` as two codes around
a `/`, and `PST.PTCP` as one code (it wins over the `PST` nested inside it). Every string
below is fully covered by the legend once `1` is added — verified against the live 65-row
legend.

### 3d. Distribution of the 110 proposed strings

| morphology | senses |
|---|---|
| `1SG` | 19 |
| `PST` | 16 |
| `PL` | 12 |
| `1PL` | 9 |
| `2SG` | 9 |
| `3SG` | 9 |
| `3PL` | 4 |
| `3SG/3PL` | 4 |
| `SG` | 4 |
| `2PL` | 3 |
| `PST.PTCP` | 3 |
| `SG/PL` | 3 |
| `1PL.PST` | 2 |
| `1SG.PST` | 2 |
| `3SG.PRS/PST` | 2 |
| `PRS/PST` | 2 |
| `1.PST` | 1 |
| `2SG.PRS` | 1 |
| `2SG.PST` | 1 |
| `3` | 1 |
| `3.PST.PTCP` | 1 |
| `3PL.PST.PTCP` | 1 |
| `PL.EMPH` | 1 |

### 3e. Senses left with NO part of speech — 3, need an eyeball

Removing the pseudo-POS empties these three arrays. The mechanical rule adds `v`; two of the
three look right, one does not:

| entry | gloss | current POS | proposed POS | morphology | verdict |
|---|---|---|---|---|---|
| Áʼbitʼà | touch ("you touch") | `2nd pers. sing.` | `v` | `2SG` | ✅ sibling sense is `["v"]` "touch" |
| Wéšną | pleased ("delighted, satisfied") | `past t.` | `v` | `PST` | ⚠️ `v` or `adj`? Ponca marks many stative concepts `adj` |
| wíwítʼa | they are mine | `pl./emphatic` | `v` | `PL.EMPH` | ❌ should be `poss` — see 2b |

### 3f. Entry-level vs sense-level — the one structural wrinkle

`morphology` lives on **`entries`**, but these labels are on **`senses`**. For 103 of the 110
senses that's harmless (single-sense entries, or sibling senses that agree). **No entry has two
affected senses that disagree** — verified.

But **two entries have an affected sense sitting next to an unaffected one**, so an entry-level
code would over-claim:

| entry | sense 1 | sense 2 | risk |
|---|---|---|---|
| Áʼbitʼà | `["v"]` "touch" — *pressing with fingers…* | `["2nd pers. sing."]` "touch" — *you touch* | `2SG` on the entry implies sense 1 is also 2SG |
| Úđitʼą̀ | `["adj"]` "complicated" | `["n","3rd pers. sing."]` "work" — *he/she/it has work* | `3SG` on the entry implies sense 1 is also 3SG |

Options: (a) write the code anyway and accept the mild over-claim on 2 entries out of 105
(recommended — the alternative is leaving those two entries un-migrated and keeping the
pseudo-POS around); (b) skip those two entries; (c) put the code in the sense **definition**
instead for those two. Recommend (a) + a note in the issue file.

### 3g. Full per-sense plan

⚠️ = the POS array would be empty without an added default (part 3e).

| lexeme | gloss | current POS | → POS | → morphology |
|---|---|---|---|---|
| Ábaną̀ | to look at or gaze at an individual person or thing | `v`, `sing.` | `v` | `SG` |
| Ą́baskiđè | exasperated | `v`, `1st pers. sing.` | `v` | `1SG` |
| Ađį́ áti | of “to bring” | `v. past t.`, `past part.` | `v` | `PST.PTCP` |
| Ađį́ą́gađį̀ | bringing | `v`, `pl` | `v` | `PL` |
| Ađiáti | brought here | `v`, `past t.` | `v` | `PST` |
| Ąđísiđè | remember | `v`, `1st pers. pl.` | `v` | `1PL` |
| Áđiudè | abandoned | `vt`, `past t.` | `vt` | `PST` |
| Ađį́ʼ | keep | `v`, `3rd pers. sing.`, `pres./past t.` | `v` | `3SG.PRS/PST` |
| Ađį́ʼ | has | `v`, `3rd pers. sing.`, `pres./past t.` | `v` | `3SG.PRS/PST` |
| Ą́gabagđaì | to be hesitant | `v`, `3rd pers. pl.` | `v` | `3PL` |
| Ągáđèʼtʼè | depart | `vt`, `1st pers. pl.` | `vt` | `1PL` |
| Ągáđįtʼągatą̀ | future perfect tense | `v`, `1st pers. pl.` | `v` | `1PL` |
| Agđáđį | has | `v`, `1st pers. sing.` | `v` | `1SG` |
| Agđáđį | keep | `v`, `1st pers. sing.` | `v` | `1SG` |
| Ągúwąì | we burned it | `v`, `1st pers. pl.` | `v` | `1PL` |
| Ahíbažì | did not come here | `v`, `sing./pl.` | `v` | `SG/PL` |
| Ahíʼ | arrived | `v`, `3rd pers. pl.`, `past part.` | `v` | `3PL.PST.PTCP` |
| Akíbažì | did not return | `v`, `sing./pl.` | `v` | `SG/PL` |
| Ákiđà | challenge | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Ákiđà | contend | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Akiʼ | returned | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Akʼíwahą̀ | to pray for oneself | `v`, `1st pers. sing.` | `v` | `1SG` |
| Aną́bđì | mistaken | `v`, `1st pers. sing.` | `v` | `1SG` |
| Aną́žį | stand | `v`, `1st pers. sing.` | `v` | `1SG` |
| Ánaʼù | passed by | `v`, `past t.` | `v` | `PST` |
| Atíʼ | to arrive | `v`, `3rd pers. sing./pl.` | `v` | `3SG/3PL` |
| Ąwą́đísiđè | remember | `v`, `1st pers. pl.` | `v` | `1PL` |
| Ąwą́nąđì | mistaken | `v`, `1st pers. pl.` | `v` | `1PL` |
| Ayáđaì | left | `v`, `3rd pers. sing./pl.` | `v` | `3SG/3PL` |
| Ą́zegiđaì | they relaxed | `v`, `3rd pers. pl.` | `v` | `3PL` |
| Áʼbitʼà | touch | `2nd pers. sing.` | `v` ⚠️ | `2SG` |
| Aʼgđáʼi | leaving | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Aʼgđéʼ | going back | `v`, `1st pers. sing.` | `v` | `1SG` |
| Aʼgđį́ʼ | sit | `v`, `1st pers. sing.` | `v` | `1SG` |
| Ąʼwą́đataì | ate | `v`, `1st pers. pl.`, `past t.` | `v` | `1PL.PST` |
| Ąʼwą́ʼškąʼì | struggle | `v`, `1st pers. pl.` | `v` | `1PL` |
| Bđé | going | `v`, `1st pers. sing.` | `v` | `1SG` |
| Bixą́íʼ | to be broken | `v`, `past t.` | `v` | `PST` |
| Đaną́nì | mistaken | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Đaną́niį̀ | mistaken | `v`, `2nd pers. pl.` | `v` | `2PL` |
| Đatíʼ | arrive | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Đéđaì | sent | `v`, `past part.` | `v` | `PST.PTCP` |
| Đéđaì | sent | `v`, `past part.` | `v` | `PST.PTCP` |
| Điđítʼa | yours | `pl. pron.` | `pro` | `PL` |
| Điđítʼaì | yours | `pl. pron.` | `pro` | `PL` |
| Đizái | to get | `v`, `3rd pers.`, `past part.` | `v` | `3.PST.PTCP` |
| Duáđąkà | these | `pl. pron.` | `pro` | `PL` |
| Duáte | these | `pl. pron.` | `pro` | `PL` |
| Edíʼą́đì | we were there | `v`, `1st pers. pl.`, `past t.` | `v` | `1PL.PST` |
| Edíʼbđì | I was there | `v`, `1st pers. sing.`, `past t.` | `v` | `1SG.PST` |
| Edíʼni | you were there | `v`, `2nd pers. sing.`, `past t.` | `v` | `2SG.PST` |
| Etái | he/she/it/they own/s | `vt`, `adj`, `3rd pers.` | `vt`, `adj` | `3` |
| Gđíze | recover | `v`, `pres./past t.` | `v` | `PRS/PST` |
| Gíga | (fem., giá) | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Giní | recovered | `v`, `past t.` | `v` | `PST` |
| Į́·đe | happy | `v`, `1st pers. sing.` | `v` | `1SG` |
| Iđáhąbđè | dreamed | `v`, `past t.` | `v` | `PST` |
| Iđáhusà | scold | `v`, `1st pers. sing.` | `v` | `1SG` |
| Íđaúsiʼštʼą̀ | you fabricated a story | `v`, `2nd pers. sing.`, `pres. t.` | `v` | `2SG.PRS` |
| Iđáʼđè | I found | `v`, `1st pers. sing.` | `v` | `1SG` |
| Iđéʼ | of go | `v`, `past t.` | `v` | `PST` |
| Iną́đaì | placed | `v`, `past t.` | `v` | `PST` |
| Į́nąʼù | passed by me | `v`, `past t.` | `v` | `PST` |
| Itʼúšʼpʼà | grandchild | `n`, `3rd pers. sing./pl.` | `n` | `3SG/3PL` |
| Íʼbʼahąì | knew | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Íʼda | birthed | `v`, `past t.` | `v` | `PST` |
| Íʼkʼigđaè | shared | `v`, `pres./past t.` | `v` | `PRS/PST` |
| Íʼšpʼahą̀ | you know | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Íʼšpʼahąʼì | you all know | `v`, `2nd pers. pl.` | `v` | `2PL` |
| Kigđái | departed | `vt`, `3rd pers. pl.` | `vt` | `3PL` |
| Mąną́ni | you made a mistake | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Ną́de ąpíʼmąžį̀ | distressed | `v.aux`, `1st pers. sing.` | `v.aux` | `1SG` |
| Ną́de ąpíʼmąžį̀ | distressed | `v.aux`, `1st pers. sing.` | `v.aux` | `1SG` |
| Ną́de ąpʼímąžį̀ | worried | `v.aux`, `1st pers. sing.` | `v.aux` | `1SG` |
| Ną́đį | mistaken | `v`, `3rd pers. sing./pl.` | `v` | `3SG/3PL` |
| Nášabè | tanned | `v`, `past t.` | `v` | `PST` |
| Náži | stopped burning | `v`, `past t.` | `v` | `PST` |
| Pʼíʼ | arrive | `v`, `1st pers. sing.` | `v` | `1SG` |
| Šąkéđaʼ(đagà) | leave it alone | `vt`, `sing.` | `vt` | `SG` |
| Šąméwađà (đagà) | leave them alone | `vt`, `pl` | `vt` | `PL` |
| Šątéđà (đagà) | leave them alone | `vt`, `pl` | `vt` | `PL` |
| Šéđąkà | those | `pl. pron.` | `pro` | `PL` |
| Šéʼgè | of that | `pl. pron.` | `pro` | `PL` |
| Šę́ʼháíʼmà | you | `pl. pron.` | `pro` | `PL` |
| Sipʼáʼ | toes | `n`, `pl` | `n` | `PL` |
| Tiđéđe | to start a song | `v`, `sing.` | `v` | `SG` |
| Tʼíʼhuʼką̀ʼ | wind flaps at the top of the tipi that are used as a damper to control the draft inside the tipi | `n`, `pl` | `n` | `PL` |
| Uđą́ga | hold | `v`, `2nd pers. sing.` | `v` | `2SG` |
| Údątʼehà | expression | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Úđitʼą̀ | work | `n`, `3rd pers. sing.` | `n` | `3SG` |
| Uwákʼą | helped | `v`, `1st pers. sing.`, `past t.` | `v` | `1SG.PST` |
| Wađígđą̀ʼáʼákikì | indecision | `n`, `1st pers. sing.` | `n` | `1SG` |
| Wamą́skèʼnásagè | saltine crackers | `n`, `sing./pl.` | `n` | `SG/PL` |
| Wamą́ʼ | sang | `v`, `1st pers.`, `past t.` | `v` | `1.PST` |
| Wawékʼa | help | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Wawíkʼa | help | `v`, `1st pers. sing.` | `v` | `1SG` |
| Waxaí | buried | `v`, `past t.` | `v` | `PST` |
| Wéđaginąhì | permit | `v`, `2nd pers. pl.` | `v` | `2PL` |
| Wéđe | happy | `adj`, `1st pers. pl.` | `adj` | `1PL` |
| Wéku | invite | `v`, `1st pers. pl.` | `v` | `1PL` |
| Wékʼitè | cheat | `v`, `3rd pers. pl.` | `v` | `3PL` |
| Wéšną | pleased | `past t.` | `v` ⚠️ | `PST` |
| Wéʼginąhì | approve or sanction | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Wéʼį | he/she/it carried us | `pro`, `v`, `3rd pers. sing.` | `pro`, `v` | `3SG` |
| Wéʼiʼ | returned | `v`, `3rd pers. sing.` | `v` | `3SG` |
| Wítʼa | mine | `pro`, `sing.` | `pro` | `SG` |
| wíwítʼa | they are mine | `pl./emphatic` | `v` ⚠️ | `PL.EMPH` |
| Wižį́ge | son (man or woman saying, my ~) | `n`, `1st pers. sing.` | `n` | `1SG` |
| Xą́ | broke | `v`, `past t.` | `v` | `PST` |
| Xđudáđe | peeled off | `vp`, `past t.` | `vp` | `PST` |

---

## 4. Proposed replacement body for the "Parts of Speech" grammar section

Section `5bffc336-c31a-5070-8013-ae8b3f96abcc`, top-level, `sort_key` `r`. Title unchanged
("Parts of Speech"). Drop the 37-row abbreviation table; keep the intro prose.

**Do usage labels still earn a spot? Yes — but not the POS ones.** The book's table mixed two
things: POS abbreviations (dead once POS render in full) and *usage* labels, which are alive
and well inside the definitions themselves — measured on prod: `usu.` in 422 definitions +
20 glosses, `lit.` in 325 + 3, `e.g.` 53 + 3, `archaic` 54 + 1, `fem.` 30 + 4, `masc.` 30 + 2,
`esp.` 25, `orig.` 20 + 3, `slang` 4, `abbr.` 2 + 4. A reader hitting "(archaic) …" or
"lit., day number three" has nowhere else to look these up, so they stay — as a short list of
only the labels the data actually uses.

Proposed body (`{ "default": … }`, markdown):

```markdown
Every entry in the Ponca to English section of this dictionary begins with at least one
sample Ponca word, along with an English translation and an indication of the **part of
speech** in Ponca. Note that the verb is at the heart of the language and many other parts
of speech derive from verbs, including many nouns and adjectives.

Parts of speech are written out in full on each entry, so the printed book's abbreviation
key is no longer needed here. Person, number and tense — which the book also printed in the
part-of-speech slot — now appear as glossing codes in an entry's **morphology** field; the
glossing abbreviations at the end of this grammar expand every code.

A handful of abbreviations still appear inside the definitions themselves:

|   |   |
| --- | --- |
| abbr. | abbreviated |
| archaic | no longer in ordinary use |
| e.g. | for example |
| esp. | especially |
| fem. | form used by, or of, a woman |
| lit. | literally |
| masc. | form used by, or of, a man |
| orig. | originally |
| slang | slang |
| usu. | usually |
```

Notes on the draft:

- Sentence 2 of the original ("Parts of speech and other structural details are given as
  abbreviations in the entries; thus the reader may wish to consult the table below") is the
  only prose dropped — it exists solely to point at the deleted table. Sentences 1 and 3 are
  verbatim.
- The second paragraph is **new prose**, which the round-2 no-new-prose invariant covers only
  for Lane 2's re-partition; here the table is being replaced, so something has to explain the
  change. If Jacob would rather add nothing, delete that paragraph and the section is just the
  original intro + the usage-label list.
- The 10 rows are exactly the labels found in the data. Dropped from the book's table because
  they never appear: nothing else — `1st pers.`/`sing.`/`past t.` etc. are covered by the
  glossing legend once part 3 lands.

---

## 5. Decisions needed from Jacob

1. **Written-out customs** — `prepositional phrase` / `pronoun phrase` as literal POS strings
   (2a), vs. some other treatment.
2. **`pl` → morphology `PL`** (2c) — moves a technically-standard value out of POS.
3. **`pl. pron.` → `pro` + `PL`**, and **`pl./emphatic` → `poss` + `PL.EMPH`** (2b).
4. **`past part.` → keep `v` + `PST.PTCP`** vs. switch POS to `pple` (2b).
5. **Code order `1PL.PST`** vs. the legend's own `PST.…1SG` order (3c).
6. **Add legend codes `1` (required) and `2` (symmetry)** (3b).
7. **Wéšną** "pleased" → `v` or `adj` (3e).
8. **Entry-level over-claim on Áʼbitʼà + Úđitʼą̀** — accept, or skip those two (3f).

Once answered, the apply pass is one script in the same shape as
`scripts/ponca/pos-typo-merge.cjs`: PATCH `senses[].parts_of_speech` + `morphology` on the
entry, plus a PATCH of `…/grammar/sections/{id}` for the section body and 1–2
`glossing_abbreviations` inserts.
