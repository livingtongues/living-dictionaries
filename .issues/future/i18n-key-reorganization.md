# Follow-on: audit + reorganize the i18n key catalog

After the DB-backed translator system (`.issues/i18n-translator-backend.md`) lands, do a
dedicated pass over all ~980 keys "since we have the luxury" (Jacob, 2026-07-03):

- Look through all keys, sort + reorganize sections sensibly (some sections are sheet-era
  accidents; some keys live in the wrong section; possible dead keys from removed features).
- Any rename/move must ripple through: code call sites, `i18n_keys.id` rows + their
  `i18n_translations` (migrate, don't orphan — renames should carry translations over, NOT
  flag them for review), and the committed seed files.
- Ship as its own commit AFTER the system is stable in prod.
