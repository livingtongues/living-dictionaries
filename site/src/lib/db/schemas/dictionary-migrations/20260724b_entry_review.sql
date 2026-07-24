-- Editor-only "needs review" flag for entries (.issues/entry-needs-review.md).
-- JSON `{ category, note }` (see EntryReview). Set by imports/humans to queue an
-- entry for a reviewer; cleared on "Resolve". Synced like any entry column but
-- stripped from non-editor EntryData at assembly (never shown to the public).
-- `entries` already carries its lmod + server_seq triggers, so a plain column
-- add needs nothing else.
ALTER TABLE entries ADD COLUMN review TEXT; -- JSON EntryReview { category, note }
