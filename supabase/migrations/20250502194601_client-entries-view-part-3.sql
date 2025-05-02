-- ran in sql editor due to statement timeouts on these first two
-- UPDATE senses
-- SET dictionary_id = entries.dictionary_id
-- FROM entries
-- WHERE senses.entry_id = entries.id;

-- UPDATE senses
-- SET dictionary_id = entries.dictionary_id
-- FROM entries
-- WHERE senses.entry_id = entries.id
-- AND senses.id IN (
--     SELECT id FROM senses
--     WHERE dictionary_id IS NULL
--     LIMIT 40000
-- );

-- UPDATE audio_speakers
-- SET dictionary_id = audio.dictionary_id
-- FROM audio
-- WHERE audio.id = audio_speakers.audio_id;

-- UPDATE audio_speakers
-- SET dictionary_id = audio.dictionary_id
-- FROM audio
-- WHERE audio.id = audio_speakers.audio_id
-- AND audio_speakers.audio_id IN (
--     SELECT id FROM audio_speakers
--     WHERE dictionary_id IS NULL
--     LIMIT 40000
-- );

-- UPDATE video_speakers
-- SET dictionary_id = videos.dictionary_id
-- FROM videos
-- WHERE videos.id = video_speakers.video_id;

-- UPDATE entry_tags
-- SET dictionary_id = entries.dictionary_id
-- FROM entries
-- WHERE entries.id = entry_tags.entry_id;

-- UPDATE entry_dialects
-- SET dictionary_id = entries.dictionary_id
-- FROM entries
-- WHERE entries.id = entry_dialects.entry_id;

-- UPDATE sense_photos
-- SET dictionary_id = senses.dictionary_id
-- FROM senses
-- WHERE senses.id = sense_photos.sense_id;

-- UPDATE sense_videos
-- SET dictionary_id = senses.dictionary_id
-- FROM senses
-- WHERE senses.id = sense_videos.sense_id;

-- UPDATE senses_in_sentences
-- SET dictionary_id = senses.dictionary_id
-- FROM senses
-- WHERE senses.id = senses_in_sentences.sense_id;

ALTER TABLE senses ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE audio_speakers ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE video_speakers ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE entry_tags ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE entry_dialects ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE sense_photos ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE sense_videos ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE senses_in_sentences ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE sentence_videos ALTER COLUMN dictionary_id SET NOT NULL;
ALTER TABLE sentence_photos ALTER COLUMN dictionary_id SET NOT NULL;