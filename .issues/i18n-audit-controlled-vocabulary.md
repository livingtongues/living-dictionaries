# AI i18n audit — controlled vocabularies

Read-only audit of every active production row with `needs_review = 'ai'` in `gl`, `ps`, `psAbbrev`, `relationship_type`, and `sd`. Each key was assessed across all of its pending locales against its shared UI meaning.

## Coverage

| Section | Keys | AI rows reviewed | Context |
| --- | ---: | ---: | --- |
| `gl` | 303 | 368 | Language names in gloss-language selectors, labels, grammar UI, entries, and acknowledgements |
| `ps` | 91 | 148 | Full part-of-speech labels in editors and entry filters |
| `psAbbrev` | 91 | 953 | Compact part-of-speech labels on cards, lists, galleries, and dictionary-home previews |
| `relationship_type` | 38 | 684 | Related-entry picker, relationship badges, descriptions, and removal confirmation |
| `sd` | 70 | 73 | Semantic-domain facets, entry display, and print output |
| **Total** | **593** | **2,226** | |

No interpolation placeholders occur in these sections. Values not listed below were found semantically accurate enough for the UI; stylistic or equally valid terminology alternatives were deliberately excluded.

## Proposed translation corrections

### Full part-of-speech labels

| Key | English | Locale | Current | Proposed | Why |
| --- | --- | --- | --- | --- | --- |
| `ps.comp` | complement(izer) | de | Komplementierer | Komplement/Komplementierer | Current names only a complementizer and drops the alternative “complement” sense present in the source. |

### Part-of-speech abbreviations

These are compact labels, but semantic correctness takes priority where the current value names a different grammatical category.

| Key | English | Locale | Current | Proposed | Why |
| --- | --- | --- | --- | --- | --- |
| `psAbbrev.idf` | idf (idafa) | am | ሙያ | ኢዳፋ | `ሙያ` means profession/occupation, not the idafa construction. |
| `psAbbrev.msd` | msd (masdar) | am | አርእስት አንቀጽ | መስደር | Current names a nominal/title clause rather than the Arabic grammatical term *masdar*. |
| `psAbbrev.stat.v` | stat.v | am | ተገብሮ ግስ | የሁኔታ ግስ | `ተገብሮ ግስ` is the passive/inactive counterpart to `ገቢር ግስ`, not “stative verb.” |
| `psAbbrev.det` | det | ms | kgn tunjuk | penentu | `kata ganti nama tunjuk` is a demonstrative pronoun, only one possible determiner type. |
| `psAbbrev.quot` | quot | ru | кват. | квот. | The Russian linguistic term is `квотатив`; the current abbreviation has the wrong vowel. |
| `psAbbrev.v.prdg` | v.prdg | ru | глаг. паради. | глаг. парад. | Current truncation is not a valid abbreviation of `парадигма`. |
| `psAbbrev.act.v` | act.v | vi | vt động | đt chủ động | Current phrase does not express “active verb.” |
| `psAbbrev.adv.p` | adv.p | vi | trạng ngữ | cụm trạng từ | `trạng ngữ` is an adverbial/sentence element, not an adverb phrase. |
| `psAbbrev.ap` | ap | vi | tính ngữ | cụm tính từ | `tính ngữ` is an adjectival modifier, not an adjective phrase. |
| `psAbbrev.comp` | comp | vi | phụ ngữ hóa | bổ ngữ/từ bổ ngữ | Current means complementation/modifier formation rather than complement/complementizer. |
| `psAbbrev.vp` | vp | vi | vị ngữ | cụm động từ | `vị ngữ` means predicate, not verb phrase. |
| `psAbbrev.v.prdg` | v.prdg | vi | hình hệ vt | hệ hình đt | Current reverses the conventional term `hệ hình` (paradigm). |
| `psAbbrev.dem.a` | dem.a | vi | cxt động vật | cxt hữu sinh | “Animate” includes people and other living referents; `động vật` means animal. |
| `psAbbrev.dem.i` | dem.i | vi | cxt bất động vật | cxt vô sinh | “Inanimate” is `vô sinh`, not literally “non-animal.” |
| `psAbbrev.na` | na | vi | dt động vật | dt hữu sinh | Same animate-versus-animal error. |
| `psAbbrev.ni` | ni | vi | dt bất động vật | dt vô sinh | Same inanimate-versus-non-animal error. |
| `psAbbrev.pro.a` | pro.a | vi | đt động vật | đt hữu sinh | Same animate-versus-animal error. |
| `psAbbrev.pro.i` | pro.i | vi | đt bất động vật | đt vô sinh | Same inanimate-versus-non-animal error. |
| `psAbbrev.vai` | vai | vi | vt nội động vật | đt nội, hữu sinh | The current label reads as “animal” rather than the linguistic animacy class. |
| `psAbbrev.vai/ii` | vai/ii | vi | vt nội động vật/bất động vật | đt nội, hữu sinh/vô sinh | Same systematic animacy error on both halves. |
| `psAbbrev.vii` | vii | vi | vt nội bất động vật | đt nội, vô sinh | Same inanimate-versus-non-animal error. |
| `psAbbrev.vta` | vta | vi | vt ngoại động vật | đt ngoại, hữu sinh | Same animate-versus-animal error. |
| `psAbbrev.vti` | vti | vi | vt ngoại bất động vật | đt ngoại, vô sinh | Same inanimate-versus-non-animal error. |

### Related-entry relationship labels and explanations

The UI deliberately presents directional, user-readable meanings (“broader than,” “part of”), not merely isolated technical nouns.

| Key | Locale | Current | Proposed | Why |
| --- | --- | --- | --- | --- |
| `relationship_type.holonym_description` | de | Das andere Wort benennt einen Teil dieses Wortes (Hand hat Teil Finger). | Das andere Wort benennt einen Teil dieses Wortes (der Finger ist Teil der Hand). | Current example is ungrammatical. |
| `relationship_type.hypernym` | id | Lebih luas dari | Lebih umum daripada | In a semantic hierarchy this means “more general,” not spatially wider. |
| `relationship_type.hypernym_description` | id | Kata ini adalah kategori yang lebih luas yang mencakup kata lainnya (hewan lebih luas daripada anjing). | Kata ini adalah kategori yang lebih umum yang mencakup kata lainnya (hewan lebih umum daripada anjing). | Same semantic-hierarchy error in the explanation and example. |
| `relationship_type.hyponym` | id | Lebih sempit dari | Lebih khusus daripada | A hyponym is more specific, not spatially narrower. |
| `relationship_type.hyponym_description` | id | Kata ini adalah jenis khusus dari kata lainnya (anjing lebih sempit daripada hewan). | Kata ini adalah jenis khusus dari kata lainnya (anjing lebih khusus daripada hewan). | The prose defines it correctly, but the example reverts to the misleading spatial term. |
| `relationship_type.hypernym` | ms | Lebih luas daripada | Lebih umum daripada | Malay linguistic usage describes a hypernym as `makna umum`. |
| `relationship_type.hypernym_description` | ms | Kata ini ialah kategori yang lebih luas yang merangkumi kata yang lain (haiwan lebih luas daripada anjing). | Kata ini ialah kategori yang lebih umum yang merangkumi kata yang lain (haiwan lebih umum daripada anjing). | Same semantic-hierarchy error in the explanation and example. |
| `relationship_type.hyponym` | ms | Lebih sempit daripada | Lebih khusus daripada | Malay linguistic usage describes a hyponym as `makna khusus`. |
| `relationship_type.hyponym_description` | ms | Kata ini ialah jenis khusus bagi kata yang lain (anjing lebih sempit daripada haiwan). | Kata ini ialah jenis khusus bagi kata yang lain (anjing lebih khusus daripada haiwan). | The example should use the same specific/general distinction as the definition. |
| `relationship_type.meronym` | ru | Часть от | Является частью | Current phrase is unidiomatic Russian for the directional “part of” relation. |
| `relationship_type.holonym_description` | ru | Другое слово называет часть этого (рука содержит часть палец). | Другое слово называет часть этого (палец — часть руки). | Current example has broken case/grammar. |
| `relationship_type.hypernym` | vi | Rộng hơn | Khái quát hơn | The relation is semantically more general, not physically wider. |
| `relationship_type.hypernym_description` | vi | Từ này là phạm trù rộng hơn bao gồm từ kia (động vật rộng hơn chó). | Từ này thuộc phạm trù khái quát hơn và bao hàm từ kia (động vật khái quát hơn chó). | Current example reads spatially rather than as a semantic hierarchy. |
| `relationship_type.hyponym` | vi | Hẹp hơn | Cụ thể hơn | The relation is semantically more specific, not physically narrower. |
| `relationship_type.hyponym_description` | vi | Từ này là một loại cụ thể của từ kia (chó hẹp hơn động vật). | Từ này là một loại cụ thể của từ kia (chó cụ thể hơn động vật). | The definition is right but its example uses the wrong spatial sense. |
| `relationship_type.holonym_description` | zh | 另一个词指称该词的一个部分（“手”含部分“手指”）。 | 另一个词指称该词的一个部分（“手指”是“手”的一部分）。 | Current example is malformed and reverses the natural part/whole statement. |
| `relationship_type.root_of_description` | zh | 该词是另一个词由以构成的词根（teach 是 teacher 的词根）。 | 该词是构成另一个词的词根（“教”是“教师”的词根）。 | Current sentence is ungrammatical; the proposed example also makes the morphology legible to a Chinese reader. |
| `relationship_type.see_also_description` | zh | 指向另一个值得比较的词条的一般参见。 | 用于指向另一个值得比较的词条。 | `一般参见` is not a grammatical noun phrase here. |
| `relationship_type.synonym_description` | sw | Lina maana sawa au karibu sawa (dogo ↔ ndogo). | Lina maana sawa au karibu sawa (furaha ↔ shangwe). | `dogo`/`ndogo` are noun-class agreement forms of the same root, not two synonymous lexemes; the replacement is an actual near-synonym pair. |

### Semantic domains

| Key | English | Locale | Current | Proposed | Why |
| --- | --- | --- | --- | --- | --- |
| `sd.5.10` | Finance and Business | de | Finanzen und Geschäft | Finanzen und Wirtschaft | Singular `Geschäft` suggests a shop or individual transaction rather than the category “business/economy.” |
| `sd.10.4` | Coordinators, Subordinators, Relativizers, Quotatives | de | Koordinatoren, Subordinatoren, Relativierer, Quotative | Koordinatoren, Subordinatoren, Relativmarkierer, Quotative | `Relativierer` normally means something/someone that relativizes; German linguistic literature uses `Relativmarkierer` for relative-clause markers. |

## English catalog issues found while checking context

These are source/catalog defects rather than AI translation defects, so they would need code/catalog changes before translators are notified.

| Key | Current source | Proposed | Impact |
| --- | --- | --- | --- |
| `gl.seh ` | Key contains a trailing space; value is `Sena` | Rename to `gl.seh` and carry the German `Sena` value across | Dynamic lookups use the BCP code `seh`, so the current translated key is unreachable and falls back. |
| `ps.ideo` | `ideophone (onomatoepia / expressives)` | `ideophone (onomatopoeia / expressives)` | Fixes the English misspelling; existing translations remain semantically valid and should not need edits. |

All 45 translation proposals and both English catalog fixes in this report were approved and applied
on 2026-07-22. Production preserved all 18 translations during the `gl.seh` key rename and left all
18 `ps.ideo` translations intact.

## Research checks used to avoid preference-only edits

- Malay university literature describes hypernyms as `makna umum` and hyponyms as `makna khusus`, supporting the general/specific corrections over literal wide/narrow wording.
- Indonesian academic literature likewise defines the relationship as `lebih umum` versus `lebih khusus`.
- Vietnamese linguistic references describe hyponyms as having a `phạm vi nghĩa hẹp hơn` and as `cụ thể hơn`; the proposal uses the clearer user-facing `khái quát hơn` / `cụ thể hơn` distinction rather than changing to unexplained specialist labels.
- Amharic grammar sources contrast `ገቢር` with `ተገብሮ`; this confirms that the latter is not “stative.”
- Russian linguistic publications use `квотатив`, confirming `квот.` rather than `кват.`.
- German university linguistic materials use `Relativmarkierer`; searches for `Relativierer` instead resolve to the unrelated verb *relativieren*.
