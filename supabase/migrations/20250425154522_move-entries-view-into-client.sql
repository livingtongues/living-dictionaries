DROP VIEW IF EXISTS speakers_view;
DROP VIEW IF EXISTS videos_view;

ALTER TABLE entries
ALTER COLUMN created_by SET DEFAULT auth.uid(),
ALTER COLUMN updated_by SET DEFAULT auth.uid();

-- TODO: before pushing go through existing senses and connect to user_id (created_by and updated_by)
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


---------------

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

UPDATE senses
SET dictionary_id = entries.dictionary_id
FROM entries
WHERE senses.entry_id = entries.id;

UPDATE audio_speakers
SET dictionary_id = audio.dictionary_id
FROM audio
WHERE audio.id = audio_speakers.audio_id;

UPDATE video_speakers
SET dictionary_id = videos.dictionary_id
FROM videos
WHERE videos.id = video_speakers.video_id;

UPDATE entry_tags
SET dictionary_id = entries.dictionary_id
FROM entries
WHERE entries.id = entry_tags.entry_id;

UPDATE entry_dialects
SET dictionary_id = entries.dictionary_id
FROM entries
WHERE entries.id = entry_dialects.entry_id;

UPDATE sense_photos
SET dictionary_id = senses.dictionary_id
FROM senses
WHERE senses.id = sense_photos.sense_id;

UPDATE sense_videos
SET dictionary_id = senses.dictionary_id
FROM senses
WHERE senses.id = sense_videos.sense_id;

UPDATE senses_in_sentences
SET dictionary_id = senses.dictionary_id
FROM senses
WHERE senses.id = senses_in_sentences.sense_id;

UPDATE sentence_videos
SET dictionary_id = sentences.dictionary_id
FROM sentences
WHERE sentences.id = sentence_videos.sentence_id;

UPDATE sentence_photos
SET dictionary_id = sentences.dictionary_id
FROM sentences
WHERE sentences.id = sentence_photos.sentence_id;

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

CREATE POLICY "Anyone can view entries"
ON entries
FOR SELECT USING(true);

CREATE POLICY "Anyone can view senses"
ON senses
FOR SELECT USING(true);

CREATE POLICY "Anyone can view audio"
ON audio
FOR SELECT USING(true);

CREATE POLICY "Anyone can view speakers"
ON speakers
FOR SELECT USING(true);

CREATE POLICY "Anyone can view audio_speakers"
ON audio_speakers
FOR SELECT USING(true);

CREATE POLICY "Anyone can view videos"
ON videos
FOR SELECT USING(true);

CREATE POLICY "Anyone can view entry_tags"
ON entry_tags
FOR SELECT USING(true);

CREATE POLICY "Anyone can view entry_dialects"
ON entry_dialects
FOR SELECT USING(true);

CREATE POLICY "Anyone can view sense_photos"
ON sense_photos
FOR SELECT USING(true);

CREATE POLICY "Anyone can view sense_videos"
ON sense_videos
FOR SELECT USING(true);

CREATE POLICY "Anyone can view senses_in_sentences"
ON senses_in_sentences
FOR SELECT USING(true);

CREATE POLICY "Anyone can view sentence_photos"
ON sentence_photos
FOR SELECT USING(true);

CREATE POLICY "Anyone can view sentence_videos"
ON sentence_videos
FOR SELECT USING(true);

CREATE POLICY "Anyone can view texts"
ON texts
FOR SELECT USING(true);

CREATE POLICY "Managers and contributors can insert entries."
ON entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entries.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update entries."
ON entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entries.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert senses."
ON senses FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = senses.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update senses."
ON senses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = senses.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert audio."
ON audio FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = audio.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update audio."
ON audio FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = audio.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert speakers."
ON speakers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = speakers.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update speakers."
ON speakers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = speakers.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert audio_speakers."
ON audio_speakers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = audio_speakers.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update audio_speakers."
ON audio_speakers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = audio_speakers.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert tags."
ON tags FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = tags.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update tags."
ON tags FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = tags.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert entry_tags."
ON entry_tags FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entry_tags.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update entry_tags."
ON entry_tags FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entry_tags.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert dialects."
ON dialects FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dialects.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update dialects."
ON dialects FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dialects.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert entry_dialects."
ON entry_dialects FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entry_dialects.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update entry_dialects."
ON entry_dialects FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = entry_dialects.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert photos."
ON photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update photos."
ON photos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert sense_photos."
ON sense_photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sense_photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update sense_photos."
ON sense_photos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sense_photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert videos."
ON videos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update videos."
ON videos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert sense_videos."
ON sense_videos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sense_videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update sense_videos."
ON sense_videos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sense_videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert sentences."
ON sentences FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentences.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update sentences."
ON sentences FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentences.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert senses_in_sentences."
ON senses_in_sentences FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = senses_in_sentences.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update senses_in_sentences."
ON senses_in_sentences FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = senses_in_sentences.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert sentence_videos."
ON sentence_videos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentence_videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update sentence_videos."
ON sentence_videos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentence_videos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert sentence_photos."
ON sentence_photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentence_photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update sentence_photos."
ON sentence_photos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = sentence_photos.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can insert texts."
ON texts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = texts.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update texts."
ON texts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = texts.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);
