ALTER TABLE entries
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE senses
ALTER COLUMN created_by SET DATA TYPE uuid USING created_by::uuid,
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ADD CONSTRAINT senses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
ALTER COLUMN updated_by SET DATA TYPE uuid USING updated_by::uuid,
ALTER COLUMN updated_by SET DEFAULT auth.uid(),
ADD CONSTRAINT senses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id);

ALTER TABLE texts
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE sentences
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE senses_in_sentences
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE videos
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE audio
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE speakers
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE dialects
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE tags
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE audio_speakers
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE video_speakers
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE sense_videos
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE sentence_videos
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE sense_photos
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE sentence_photos
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE entry_dialects
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE entry_tags
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE senses ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE audio_speakers ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE video_speakers ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE entry_tags ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE entry_dialects ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE sense_photos ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE sense_videos ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE senses_in_sentences ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE sentence_videos ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;
ALTER TABLE sentence_photos ADD COLUMN dictionary_id text REFERENCES dictionaries ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_senses_dictionary_id ON senses (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_audio_speakers_dictionary_id ON audio_speakers (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_video_speakers_dictionary_id ON video_speakers (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_dictionary_id ON entry_tags (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dictionary_id ON entry_dialects (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_sense_photos_dictionary_id ON sense_photos (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_sense_videos_dictionary_id ON sense_videos (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_dictionary_id ON senses_in_sentences (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_dictionary_id ON sentence_videos (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_dictionary_id ON sentence_photos (dictionary_id);
CREATE INDEX IF NOT EXISTS idx_texts_dictionary_id ON texts (dictionary_id);