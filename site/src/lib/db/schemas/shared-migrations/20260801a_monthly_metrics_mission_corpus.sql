------------------------------------------------------------------
-- monthly_metrics: mission corpus STOCK (public + unlisted).
--
-- The monthly summary reports reach and corpus over the SAME grouping, so the
-- "N dictionaries · N entries" line covers public + unlisted rather than public
-- alone (Jacob, 2026-08-01). The original table only stored the public-only
-- stock, which left the post comparing a public+unlisted readership percentage
-- against a public-only corpus — two different denominators in one message.
--
-- Naming convention in this table: `*_entries` = STOCK (a count as of compute
-- time), `*_entries_created` = FLOW (created during the month). So
-- `mission_entries` is the live size of the mission corpus and
-- `mission_entries_created` is what July added to it.
--
-- Nullable + no backfill: the 2026-07 row predates these columns and cannot be
-- recomputed retroactively for stock (stock is "as of compute time", and that
-- moment has passed). Delete + recompute the row if a true refresh is wanted;
-- readers must tolerate NULL for July.
------------------------------------------------------------------

ALTER TABLE monthly_metrics ADD COLUMN mission_dictionaries INTEGER;
ALTER TABLE monthly_metrics ADD COLUMN mission_entries INTEGER;
