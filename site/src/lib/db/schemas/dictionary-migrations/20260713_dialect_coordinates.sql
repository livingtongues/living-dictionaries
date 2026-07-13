-- Dialect-level where-spoken geometry (v1 API: writable entry + dialect coordinates,
-- .issues/v1-entry-coordinates.md). Stored as the same JSON `{ points?, regions? }`
-- shape as entries/dictionaries. Entry coordinates = per-word attestation points;
-- dialect coordinates = the variety's areal extent, stored ONCE on the dialect row
-- instead of repeating a polygon across thousands of entries.
ALTER TABLE dialects ADD COLUMN coordinates TEXT;
