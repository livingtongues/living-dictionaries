# Mark /about translators in the DB — DONE for everyone with an account (2026-07-12)

Original task: look at the /about page list of translators, find the matching users in the
database, and mark each as a translator for their assigned language.

Matched the /about translators list against prod `users` (5,361 accounts) and inserted
`translator_languages` rows on the living VPS (same `INSERT OR IGNORE` shape as the admin
endpoint `add_translator_language`). Anna Luisa Daigneault skipped — she's a level-2 admin
(implicitly translator for every locale, per the migration comment).

## Assigned (9 new rows; Diego already had `es`)
- **as**: Palash Nath, Luke Horo · **hi**: Luke Horo, Bikram Jora · **he**: Dana Melaver,
  Daniel Bögre Udell · **zh**: Peng Dong, Joy Wu · **ru**: Denis Tokmashev
  (account name "grey matter", `d.tokmashev@gmail.com`)

## No account found — can't assign (Jacob: invite them, or leave until they sign up)
- **as**: Kapil Medhi, Dr. Seuji Sharma, Dr. Gitanjali Bezbaruah, Biren Baruah,
  Khagendra Nath Medhi, Pranab Sharma, Dhanmani Baishya, Chan Mohammad Ali, Rahul Choudhary
- **bn**: Sumedha Sengupta, Prof. Arun Ghosh
- **sw**: Michael Karani
- **hi**: Ashwini Parmar, Prof. K.V. Subbarao
- **or**: Anup Kumar Kujur, Panchanan Mohanty
- **pt**: Crisofia Langa da Camara
- **es**: Amanda Chao Benbassat, Mónica Bonilla Parra
- **ms**: Nur Hidayah Binte Sunaryo
- **vi**: Huy Phan
- **id**: Yustinus Ghanggo Ate

## Not translatable locales (skipped — not in `TRANSLATABLE_LOCALES`)
- sn Reggemore Marongedze · zu Mthulisi Ncube · it Iara Mantenuto · tzm Radia Sami
  (commented out in `$lib/i18n/locales.ts` UnpublishedLocales)

If any no-account person signs up later, assign via `/admin/users/[id]` (Translator languages
panel). Delete this file once Jacob has reviewed the unmatched roster.
