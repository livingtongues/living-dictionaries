import type { Database } from '../types';

export interface ChangeEntryRequestBody {
  auth_token: string;
  id: string; // id of the change, a uuidv4 created on client to make things idempotent
  dictionary_id: string;
  entry_id: string;
  table: Database['public']['Enums']['entry_tables'];
  column: string;
  row: string; // uuidv4 created by client if insert, otherwise id of row to update
  new_value: string; // JSON stringified if column type is jsonb (glosses, parts_of_speech, semantic_domains, write_in_semantic_domains)
  old_value: string | undefined;
  timestamp: string;
}
