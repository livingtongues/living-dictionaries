UPDATE audio
SET storage_path =
  substr(storage_path, 1, instr(storage_path, '/audio/') + 6)
  || id
  || CASE
    WHEN lower(storage_path) LIKE '%.webm' THEN '.webm'
    WHEN lower(storage_path) LIKE '%.mp3' THEN '.mp3'
    WHEN lower(storage_path) LIKE '%.m4a' THEN '.m4a'
    WHEN lower(storage_path) LIKE '%.ogg' THEN '.ogg'
    WHEN lower(storage_path) LIKE '%.oga' THEN '.oga'
    WHEN lower(storage_path) LIKE '%.aac' THEN '.aac'
    WHEN lower(storage_path) LIKE '%.flac' THEN '.flac'
    ELSE '.wav'
  END
WHERE storage_path LIKE '%/audio/%/%';
