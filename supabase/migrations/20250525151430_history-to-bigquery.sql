CREATE extension IF NOT EXISTS wrappers WITH SCHEMA extensions;

create foreign data wrapper bigquery_wrapper
  handler big_query_fdw_handler
  validator big_query_fdw_validator;

-- Save BigQuery service account json in Vault and retrieve the created `key_id`
select vault.create_secret(
  '
    {
      "type": "service_account",
      "project_id": "your_gcp_project_id",
      "private_key_id": "your_private_key_id",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      ...
    }
  ',
  'bigquery',
  'BigQuery service account json for Wrappers'
);

create server bigquery_server
  foreign data wrapper bigquery_wrapper
  options (
    sa_key_id '<key_ID>', -- The Key ID from above.
    project_id 'your_gcp_project_id',
    dataset_id 'your_gcp_dataset_id'
  );

create schema if not exists bigquery;

create foreign table bigquery.my_bigquery_table (
  id bigint,
  name text,
  ts timestamp
)
  server bigquery_server
  options (
    table 'people',
    location 'EU'
  );


------------------------------------------------------------

CREATE TRIGGER set_created_by_trigger_senses_in_sentences
BEFORE UPDATE ON senses_in_sentences
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_audio_speakers
BEFORE UPDATE ON audio_speakers
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_video_speakers
BEFORE UPDATE ON video_speakers
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sense_videos
BEFORE UPDATE ON sense_videos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sentence_videos
BEFORE UPDATE ON sentence_videos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sense_photos
BEFORE UPDATE ON sense_photos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sentence_photos
BEFORE UPDATE ON sentence_photos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_entry_dialects
BEFORE UPDATE ON entry_dialects
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_entry_tags
BEFORE UPDATE ON entry_tags
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_invites
BEFORE UPDATE ON invites
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_dictionary_info
BEFORE UPDATE ON dictionary_info
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_dictionary_partners
BEFORE UPDATE ON dictionary_partners
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_api_keys
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION set_created_by();




