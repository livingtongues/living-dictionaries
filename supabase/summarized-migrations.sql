CREATE TYPE entry_tables AS ENUM ('senses'); -- TODO: drop (not using)
CREATE TYPE entry_columns AS ENUM ('deleted', 'glosses', 'parts_of_speech', 'semantic_domains', 'write_in_semantic_domains', 'noun_class', 'definition'); -- TODO: drop (not using)

CREATE TABLE entry_updates ( -- TODO: drop this table
  id uuid unique primary key NOT NULL,
  user_id text NOT NULL,
  dictionary_id text NOT NULL,
  entry_id text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "table" entry_tables NOT NULL,
  "row" text NOT NULL,
  "column" entry_columns NOT NULL,
  new_value text,
  old_value text
);

ALTER TABLE entry_updates ENABLE ROW LEVEL SECURITY;

CREATE TYPE certainty AS ENUM ('yes', 'no', 'unknown');

CREATE TABLE dictionaries (
  id text unique primary key NOT NULL,
  url text unique NOT NULL,
  name text NOT NULL,
  alternate_names text[],
  orthographies jsonb[], -- defaults to latin first, but other bcp codes or custom orthographies can be added, these are the keys for MultiString used by each dictionary
  gloss_languages text[],
  location text,
  iso_639_3 text,
  glottocode text,
  coordinates jsonb, -- Coordinates
  public boolean NOT NULL DEFAULT false,
  print_access boolean,
  copyright text,

  language_used_by_community boolean,
  community_permission certainty,
  author_connection text,
  con_language_description text,

  featured_image jsonb,
  hide_living_tongues_logo boolean,
  metadata jsonb, -- tdv1 info
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dictionaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for dictionaries"
ON dictionaries
FOR SELECT USING(true);

CREATE TABLE entries (
  id text unique primary key NOT NULL, -- generated on client so users can create an entry offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  lexeme jsonb NOT NULL, -- MultiString
  phonetic text,
  interlinearization text,
  morphology text,
  notes jsonb, -- MultiString
  sources text[],
  scientific_names text[],
  coordinates jsonb, -- Coordinates
  unsupported_fields jsonb, -- to place fields from imports like FLEx that don't fit into the current fields
  elicitation_id text, -- Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex, used for Onondaga custom sort
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE senses (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a sense offline and keep editing it
  entry_id text NOT NULL REFERENCES entries,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  "definition" jsonb, -- MultiString
  glosses jsonb, -- MultiString
  parts_of_speech text[],
  semantic_domains text[],
  write_in_semantic_domains text[],
  noun_class character varying,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  plural_form jsonb, -- MultiString
  variant jsonb -- MultiString
);

ALTER TABLE senses ENABLE ROW LEVEL SECURITY;

CREATE TABLE texts (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a text offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  title jsonb NOT NULL, -- MultiString
  sentences jsonb NOT NULL, -- array of sentence ids to be able to know order, also includes paragraph breaks
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE texts ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentences (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a sentence offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  "text" jsonb, -- MultiString
  translation jsonb, -- MultiString
  text_id uuid REFERENCES texts, -- if part of a text
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;

CREATE TABLE senses_in_sentences (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (sense_id, sentence_id)
);

ALTER TABLE senses_in_sentences ENABLE ROW LEVEL SECURITY;

CREATE TABLE photos (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text NOT NULL,
  serving_url text NOT NULL,
  source text,
  photographer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE videos (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text,
  hosted_elsewhere jsonb, -- Hosted elsewhere (e.g. YouTube, Vimeo, etc.)
  text_id uuid REFERENCES texts,
  source text,
  videographer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE audio (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  entry_id text REFERENCES entries,
  sentence_id uuid REFERENCES sentences,
  text_id uuid REFERENCES texts,
  storage_path text NOT NULL,
  source text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE audio ENABLE ROW LEVEL SECURITY;

CREATE TYPE gender AS ENUM ('m', 'f', 'o');

CREATE TABLE speakers (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users, -- only if speaker has an account
  name text NOT NULL,
  decade integer,
  gender gender,
  birthplace text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;

-- RELATIONSHIPS

CREATE TABLE audio_speakers (
  audio_id uuid NOT NULL REFERENCES audio ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (audio_id, speaker_id)
);

ALTER TABLE audio_speakers ENABLE ROW LEVEL SECURITY;

CREATE TABLE video_speakers (
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (video_id, speaker_id)
);

ALTER TABLE video_speakers ENABLE ROW LEVEL SECURITY;

CREATE TABLE sense_videos (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (sense_id, video_id)
);

ALTER TABLE sense_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentence_videos (
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (sentence_id, video_id)
);

ALTER TABLE sentence_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sense_photos (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (sense_id, photo_id)
);

ALTER TABLE sense_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentence_photos (
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (sentence_id, photo_id)
);

ALTER TABLE sentence_photos ENABLE ROW LEVEL SECURITY;

CREATE TYPE content_tables AS ENUM ('entries', 'senses', 'sentences', 'senses_in_sentences', 'texts', 'audio', 'video', 'photo', 'speakers', 'audio_speakers', 'video_speakers', 'sense_videos', 'sentence_videos', 'sense_photos', 'sentence_photos');

CREATE TABLE content_updates (
  id uuid unique primary key NOT NULL, -- generated by client via uuidv4 so it can be idempotent and they can send it multiple times without repeated effect in case of network issues
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  dictionary_id text NOT NULL REFERENCES dictionaries,
  entry_id text REFERENCES entries,
  sense_id uuid REFERENCES senses,
  sentence_id uuid REFERENCES sentences,
  text_id uuid REFERENCES texts,
  audio_id uuid REFERENCES audio,
  video_id uuid REFERENCES videos,
  photo_id uuid REFERENCES photos,
  speaker_id uuid REFERENCES speakers,
  dialect_id uuid REFERENCES dialects,
  tag_id uuid REFERENCES tags,
  "table" content_tables, -- will drop down the road
  change jsonb,
  "data" jsonb,
  "type" text,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  import_id text
);

ALTER TABLE content_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Can view content updates" 
ON content_updates
FOR SELECT
USING (TRUE);

CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_created_by_trigger_dictionaries
BEFORE UPDATE ON dictionaries
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_entries
BEFORE UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_senses
BEFORE UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_texts
BEFORE UPDATE ON texts
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sentences
BEFORE UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_photos
BEFORE UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_audio
BEFORE UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_videos
BEFORE UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_speakers
BEFORE UPDATE ON speakers
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE VIEW public.user_emails AS SELECT id, email, last_sign_in_at, created_at FROM auth.users;
REVOKE ALL ON public.user_emails FROM anon, authenticated;

CREATE TABLE dialects (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name jsonb NOT NULL, -- MultiString
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dialects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dialects"
ON dialects 
FOR SELECT USING (true);

CREATE TABLE entry_dialects (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  dialect_id uuid NOT NULL REFERENCES dialects ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (entry_id, dialect_id)
);

ALTER TABLE entry_dialects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_dialects
BEFORE UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE POLICY "Anyone can view sentences"
ON sentences 
FOR SELECT USING (true);

CREATE POLICY "Anyone can view photos"
ON photos 
FOR SELECT USING (true);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

ALTER ROLE "anon" SET "statement_timeout" TO '8s';
NOTIFY pgrst, 'reload config';

CREATE TABLE tags (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name text NOT NULL,
  private boolean,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags"
ON tags 
FOR SELECT USING (true);

CREATE TABLE entry_tags (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_tags
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE OR REPLACE FUNCTION update_sense_sentences_when_sentence_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_sentences
    SET deleted = NEW.deleted
    WHERE sentence_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_sentences
AFTER UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_sense_sentences_when_sentence_deleted();

CREATE OR REPLACE FUNCTION update_sense_photos_when_photo_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_photos
    SET deleted = NEW.deleted
    WHERE photo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_photos
AFTER UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_sense_photos_when_photo_deleted();

CREATE OR REPLACE FUNCTION update_sense_videos_when_video_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_videos
    SET deleted = NEW.deleted
    WHERE video_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_videos
AFTER UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_sense_videos_when_video_deleted();

CREATE OR REPLACE FUNCTION update_dictionary_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  dictionary_id_to_use text;
  new_updated_at timestamp with time zone;
BEGIN
  dictionary_id_to_use := COALESCE(NEW.dictionary_id, OLD.dictionary_id);

  BEGIN
    new_updated_at := NEW.updated_at;
  EXCEPTION
    WHEN others THEN
      new_updated_at := NULL;
  END;
  
  UPDATE dictionaries
  SET updated_at = COALESCE(new_updated_at, NEW.deleted, NEW.created_at, NOW())
  WHERE id = dictionary_id_to_use;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dictionary_updated_at_entries
AFTER INSERT OR UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_senses
AFTER INSERT OR UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_audio
AFTER INSERT OR UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_speakers
AFTER INSERT OR UPDATE ON speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_tags
AFTER INSERT OR UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_dialects
AFTER INSERT OR UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_photos
AFTER INSERT OR UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_videos
AFTER INSERT OR UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sentences
AFTER INSERT OR UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_audio_speakers
AFTER INSERT OR UPDATE ON audio_speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_entry_tags
AFTER INSERT OR UPDATE ON entry_tags
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_entry_dialects
AFTER INSERT OR UPDATE ON entry_dialects
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sense_photos
AFTER INSERT OR UPDATE ON sense_photos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_video_speakers
AFTER INSERT OR UPDATE ON video_speakers
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_sense_videos
AFTER INSERT OR UPDATE ON sense_videos
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE TRIGGER update_dictionary_updated_at_senses_in_sentences
AFTER INSERT OR UPDATE ON senses_in_sentences
FOR EACH ROW
EXECUTE FUNCTION update_dictionary_updated_at();

CREATE VIEW dictionaries_view AS
SELECT
  dictionaries.id,
  url,
  name,
  alternate_names,
  gloss_languages,
  location,
  dictionaries.coordinates,
  iso_639_3,
  glottocode,
  public,
  print_access,
  dictionaries.metadata,
  COUNT(entries.id) AS entry_count,
  -- Below is just for the admin table, only the above is included in the materialized view which is used on the homepage and the dictionaries listing page
  orthographies,
  featured_image,
  author_connection,
  community_permission,
  language_used_by_community,
  con_language_description,
  copyright,
  deleted,
  dictionaries.created_at,
  dictionaries.created_by,
  dictionaries.updated_at,
  dictionaries.updated_by
FROM dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id AND entries.deleted IS NULL -- can take out the LEFT to eliminate dictionaries with 0 entries
WHERE dictionaries.deleted IS NULL
GROUP BY dictionaries.id
ORDER BY name;

CREATE MATERIALIZED VIEW materialized_admin_dictionaries_view AS
SELECT * FROM dictionaries_view;
CREATE UNIQUE INDEX idx_materialized_admin_dictionaries_view_id ON materialized_admin_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:
SELECT cron.schedule (
    'refresh-materialized_admin_dictionaries_view', -- Job name
    '0 0 * * *', -- Every day, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_admin_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');

CREATE MATERIALIZED VIEW materialized_dictionaries_view AS
SELECT 
  id,
  url,
  name,
  alternate_names,
  gloss_languages,
  location,
  coordinates,
  iso_639_3,
  glottocode,
  public,
  metadata,
  con_language_description,
  entry_count,
  deleted
FROM dictionaries_view;
-- DROP MATERIALIZED VIEW materialized_dictionaries_view

CREATE UNIQUE INDEX idx_materialized_dictionaries_view_id ON materialized_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:

SELECT cron.schedule (
    'refresh-materialized_dictionaries_view', -- Job name
    '0 * * * *', -- Every hour, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');


CREATE VIEW profiles_view AS
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' AS full_name,
    raw_user_meta_data->>'avatar_url' AS avatar_url
FROM auth.users;
REVOKE ALL ON public.profiles_view FROM anon, authenticated, public;

CREATE TABLE user_data (
  id uuid references auth.users not null primary key ON DELETE CASCADE,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  welcome_email_sent timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  terms_agreement timestamp with time zone
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their user_data." 
ON user_data FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their user_data." 
ON user_data FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  result INT;
BEGIN
  INSERT INTO public.user_data (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


CREATE POLICY "Users can create dictionaries."
ON dictionaries FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by 
    AND auth.uid() = updated_by 
    AND length(id) >= 3
);

CREATE TYPE role_enum AS ENUM ('manager', 'contributor');

CREATE TABLE dictionary_roles (
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  role role_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES auth.users,
  PRIMARY KEY (dictionary_id, user_id, role)
);

ALTER TABLE dictionary_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and contributors can view dictionary roles."
ON dictionary_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE FUNCTION add_manager_on_new_dictionary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.dictionary_roles (dictionary_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'manager');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_dictionary_created
AFTER INSERT ON public.dictionaries
FOR EACH ROW EXECUTE PROCEDURE add_manager_on_new_dictionary();

CREATE POLICY "Managers can remove contributors."
ON dictionary_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_roles.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionaries."
ON dictionaries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionaries.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE VIEW dictionary_roles_with_profiles AS
SELECT 
  dictionary_roles.dictionary_id,
  dictionary_roles.user_id,
  dictionary_roles.role,
  profiles_view.full_name,
  profiles_view.avatar_url
FROM dictionary_roles
JOIN profiles_view ON dictionary_roles.user_id = profiles_view.id;

CREATE TYPE status_enum AS ENUM ('queued', 'sent', 'claimed', 'cancelled');

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  inviter_email text NOT NULL,
  target_email text NOT NULL,
  role role_enum NOT NULL,
  status status_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL default auth.uid() REFERENCES auth.users
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can do everything on invites."
ON invites FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Invited users can view their invites."
ON invites FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = invites.target_email
);

CREATE POLICY "Invited users can mark their invites claimed."
ON invites FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'email' = invites.target_email);

CREATE POLICY "Invited users can add themselves to the dictionary roles."
ON dictionary_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM invites
    WHERE invites.dictionary_id = dictionary_roles.dictionary_id
      AND invites.role = dictionary_roles.role
      AND invites.target_email = auth.jwt() ->> 'email'
      AND invites.status = 'sent'
  )
);

CREATE TABLE dictionary_info (
  id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  about text,
  grammar text,
  citation text,
  write_in_collaborators text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL default auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL default auth.uid() REFERENCES auth.users,
  PRIMARY KEY (id)
);

ALTER TABLE dictionary_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can insert dictionary info."
ON dictionary_info FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionary info."
ON dictionary_info FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary info."
ON dictionary_info FOR SELECT
USING (true);

------------------------

CREATE TABLE dictionary_partners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name text NOT NULL,
  photo_id uuid REFERENCES photos,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users default auth.uid()
);

ALTER TABLE dictionary_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can add, edit, remove dictionary partners."
ON dictionary_partners FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary partners."
ON dictionary_partners FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION get_my_claim(claim TEXT) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  	coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' -> claim, null)
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
    LANGUAGE sql STABLE
    AS $$
  SELECT coalesce(get_my_claim('admin')::numeric, 0) > 0
$$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('
            CREATE POLICY "Admin level 1 can perform any action on %I"
            ON %I FOR ALL
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());
        ', r.tablename, r.tablename);
    END LOOP;
END $$;

--- auto modify timestamps ---

create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on dictionaries
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on user_data
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on entries
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on senses
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on texts
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on sentences
  for each row execute procedure moddatetime (updated_at);
  
create trigger handle_updated_at before update on photos
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on videos
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on audio
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on speakers
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dialects
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on tags
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dictionary_info
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on dictionary_partners
  for each row execute procedure moddatetime (updated_at);

CREATE FUNCTION users_for_admin_table()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    unsubscribed_from_emails timestamp with time zone,
    updated_at timestamp with time zone
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        auth.users.id,
        auth.users.email::text,
        auth.users.raw_user_meta_data->>'full_name' AS full_name,
        auth.users.raw_user_meta_data->>'avatar_url' AS avatar_url,
        auth.users.last_sign_in_at,
        auth.users.created_at,
        user_data.unsubscribed_from_emails,
        COALESCE(user_data.updated_at, auth.users.last_sign_in_at) AS updated_at
    FROM auth.users
    LEFT JOIN user_data ON auth.users.id = user_data.id
    GROUP BY auth.users.id, user_data.unsubscribed_from_emails, user_data.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  can_write boolean,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  last_read_at timestamp with time zone,
  last_write_at timestamp with time zone,
  use_count integer DEFAULT 0 NOT NULL
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can add, view, edit, remove api keys."
ON api_keys FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = api_keys.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = api_keys.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE INDEX IF NOT EXISTS idx_entries_dictionary_id_updated_at ON entries (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_senses_dictionary_id_updated_at ON senses (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_audio_dictionary_id_updated_at ON audio (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_speakers_dictionary_id_updated_at ON speakers (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tags_dictionary_id_updated_at ON tags (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_dialects_dictionary_id_updated_at ON dialects (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_photos_dictionary_id_updated_at ON photos (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_dictionary_id_updated_at ON videos (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sentences_dictionary_id_updated_at ON sentences (dictionary_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_texts_dictionary_id_updated_at ON texts (dictionary_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_audio_speakers_dictionary_id_created_at ON audio_speakers (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_video_speakers_dictionary_id_created_at ON video_speakers (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entry_tags_dictionary_id_created_at ON entry_tags (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dictionary_id_created_at ON entry_dialects (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sense_photos_dictionary_id_created_at ON sense_photos (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sense_videos_dictionary_id_created_at ON sense_videos (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_dictionary_id_created_at ON senses_in_sentences (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sentence_photos_dictionary_id_created_at ON sentence_photos (dictionary_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sentence_videos_dictionary_id_created_at ON sentence_videos (dictionary_id, created_at);

CREATE INDEX IF NOT EXISTS idx_entries_dictionary_id_id_where_not_deleted ON entries (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_senses_dictionary_id_id_where_not_deleted ON senses (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_audio_dictionary_id_id_where_not_deleted ON audio (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_speakers_dictionary_id_id_where_not_deleted ON speakers (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_dictionary_id_id_where_not_deleted ON tags (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_dialects_dictionary_id_id_where_not_deleted ON dialects (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_dictionary_id_id_where_not_deleted ON photos (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_videos_dictionary_id_id_where_not_deleted ON videos (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentences_dictionary_id_id_where_not_deleted ON sentences (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_texts_dictionary_id_id_where_not_deleted ON texts (dictionary_id, id) WHERE deleted IS NULL;

CREATE INDEX IF NOT EXISTS idx_audio_speakers_dictionary_id_where_not_deleted ON audio_speakers (dictionary_id, audio_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_video_speakers_dictionary_id_where_not_deleted ON video_speakers (dictionary_id, video_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_entry_tags_dictionary_id_where_not_deleted ON entry_tags (dictionary_id, entry_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dictionary_id_where_not_deleted ON entry_dialects (dictionary_id, entry_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sense_photos_dictionary_id_where_not_deleted ON sense_photos (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sense_videos_dictionary_id_where_not_deleted ON sense_videos (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_dictionary_id_where_not_deleted ON senses_in_sentences (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentence_photos_dictionary_id_where_not_deleted ON sentence_photos (dictionary_id, sentence_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentence_videos_dictionary_id_where_not_deleted ON sentence_videos (dictionary_id, sentence_id) WHERE deleted IS NULL;

