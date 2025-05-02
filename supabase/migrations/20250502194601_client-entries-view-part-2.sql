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

CREATE POLICY "Anyone can view video_speakers"
ON video_speakers
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

CREATE POLICY "Managers and contributors can insert video_speakers."
ON video_speakers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = video_speakers.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role IN ('manager', 'contributor')
  )
);

CREATE POLICY "Managers and contributors can update video_speakers."
ON video_speakers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = video_speakers.dictionary_id
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
