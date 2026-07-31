# Waiting on Jacob — small pending actions

Consolidated 2026-07-31 from several otherwise-finished issues (full context in git history:
`icon-picks-and-house-mirror.md`, `translators.md`, `media-duration-and-language-stats.md`,
`api-v1-front-door-restructure.md`).

## 1. Icon-review glyph picks (since 2026-07-12)

14 ex-Pro-regular glyphs provisionally use `~icons/fa-solid` (info-circle, donate, times, bars,
sign-in-alt, key, undo, spinner, pencil-alt, link, language, film, upload, check).
`/admin/icon-review` (level 3, on prod) shows Pro original vs provisional fa-solid vs mdi-outline
with tap-select. Jacob taps picks → agent applies across call sites → **DELETE the
`/admin/icon-review` page**. (house's mirror of the button/icon migration is tracked house-side.)

## 2. World Bank language-stats email (ready since 2026-07-29)

CSV generated + verified: `~/reports/living-dictionaries-language-stats-2026-07-29.csv` (mustang).
Reply draft: `~/reports/world-bank-reply-draft.md`. Jacob sends. Generator committed at
`scripts/language-stats/` for re-runs.

## 3. Translator roster — people with no account (since 2026-07-12)

Everyone on /about WITH an account got `translator_languages` rows. These have no account —
invite them, or leave until they sign up (then assign via `/admin/users/[id]`):

- **as**: Kapil Medhi, Dr. Seuji Sharma, Dr. Gitanjali Bezbaruah, Biren Baruah,
  Khagendra Nath Medhi, Pranab Sharma, Dhanmani Baishya, Chan Mohammad Ali, Rahul Choudhary
- **bn**: Sumedha Sengupta, Prof. Arun Ghosh · **sw**: Michael Karani
- **hi**: Ashwini Parmar, Prof. K.V. Subbarao · **or**: Anup Kumar Kujur, Panchanan Mohanty
- **pt**: Crisofia Langa da Camara · **es**: Amanda Chao Benbassat, Mónica Bonilla Parra
- **ms**: Nur Hidayah Binte Sunaryo · **vi**: Huy Phan · **id**: Yustinus Ghanggo Ate
- Not-translatable locales skipped: sn Reggemore Marongedze · zu Mthulisi Ncube ·
  it Iara Mantenuto · tzm Radia Sami (commented out in `UnpublishedLocales`)

## 4. Two small decisions from the v1 front-door restructure

- Send the Python-test user the drafted heads-up note (endpoints unchanged; only
  `openapi.json`'s default view moved)? Draft was left in that session's chat.
- Lift `/admin/api-docs` to a public `/api-docs` (or link from each dictionary's Agents page)?
  Now a move, not a rewrite.
