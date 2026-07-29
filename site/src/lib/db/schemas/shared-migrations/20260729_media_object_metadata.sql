------------------------------------------------------------------
-- Intrinsic media metadata (2026-07-29): playback duration for audio/video,
-- pixel dimensions for photo originals. Populated by upload paths going
-- forward (client-declared duration at presign, sharp dimensions in
-- /api/photo-upload) and by the weekly media sweep's metadata probe for rows
-- still missing values (v1 API uploads, undecodable-in-browser files). The
-- 2026-07 history was backfilled once via ffprobe over the public media CDN.
------------------------------------------------------------------
ALTER TABLE media_objects ADD COLUMN duration_ms INTEGER;
ALTER TABLE media_objects ADD COLUMN width INTEGER;
ALTER TABLE media_objects ADD COLUMN height INTEGER;
