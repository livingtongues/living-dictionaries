import type { TablesInsert } from '$lib/supabase/generated.types'

const uuid_template = '11111111-1111-1111-1111-111111111111'
export const seeded_user_id = '12345678-abcd-efab-cdef-123456789012'
const seeded_user_email = 'seeded@mock.com'

export const users = [{
  id: seeded_user_id,
  email: seeded_user_email,
  instance_id: '00000000-0000-0000-0000-000000000000',
  aud: 'authenticated',
  role: 'authenticated',
}]

export const seeded_dictionary_id = 'dictionary1'

export const seed_dictionaries: TablesInsert<'dictionaries'>[] = [{
  created_by: seeded_user_id,
  id: seeded_dictionary_id,
  name: 'Test Dictionary',
  updated_by: seeded_user_id,
}]

const first_entry_id = 'entry1'
const first_entry_first_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001'
const first_entry_second_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002'
const first_entry_third_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003'

const second_entry_id = 'entry2';
const second_entry_first_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011';

const first_entry_first_sense_text_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '01',
  user_id: seeded_user_email, // testing use of email for Firestore migration compatibility
  dictionary_id: seeded_dictionary_id,
  entry_id: first_entry_id,
  table: 'senses',
  row: first_entry_first_sense_id,
  column: 'noun_class',
  old_value: '1',
  new_value: '2',
}

const first_entry_first_sense_text_array_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '02',
  user_id: seeded_user_id,
  dictionary_id: seeded_dictionary_id,
  entry_id: first_entry_id,
  table: 'senses',
  row: first_entry_first_sense_id,
  column: 'parts_of_speech',
  old_value: null,
  new_value: '{n, v}',
}

const first_entry_second_sense_jsonb_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '03',
  user_id: seeded_user_id,
  dictionary_id: seeded_dictionary_id,
  entry_id: first_entry_id,
  table: 'senses',
  row: first_entry_second_sense_id,
  column: 'glosses',
  old_value: null,
  new_value: '{"en":"Hi","es":"Hola"}',
}

const first_entry_third_sense_jsonb_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '04',
  user_id: seeded_user_id,
  dictionary_id: seeded_dictionary_id,
  entry_id: first_entry_id,
  table: 'senses',
  row: first_entry_third_sense_id,
  column: 'glosses',
  old_value: null,
  new_value: '{"en":"Hi","es":"Hola"}',
}

const first_entry_third_sense_deleted_timestamp: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '05',
  user_id: seeded_user_id,
  dictionary_id: seeded_dictionary_id,
  entry_id: first_entry_id,
  table: 'senses',
  row: first_entry_third_sense_id,
  column: 'deleted',
  old_value: null,
  new_value: '2023-11-16T07:13:48.267Z',
}

const second_entry_first_sense_text_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '06',
  user_id: seeded_user_id,
  dictionary_id: seeded_dictionary_id,
  entry_id: second_entry_id,
  table: 'senses',
  row: second_entry_first_sense_id,
  column: 'noun_class',
  old_value: 'colors',
  new_value: 'animals',
}

export const entry_updates: TablesInsert<'entry_updates'>[] = [
  first_entry_first_sense_text_field,
  first_entry_first_sense_text_array_field,
  first_entry_second_sense_jsonb_field,
  first_entry_third_sense_jsonb_field,
  first_entry_third_sense_deleted_timestamp,
  second_entry_first_sense_text_field,
]

const first_sentence_id = uuid_template.slice(0, -2) + 'a1'
const second_sentence_id = uuid_template.slice(0, -2) + 'a2'
const third_sentence_id = uuid_template.slice(0, -2) + 'a3'
const fourth_sentence_id = uuid_template.slice(0, -2) + 'a4'

const first_sentence_text_attached_to_first_entry_first_sense: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '07',
  dictionary_id: seeded_dictionary_id,
  user_id: uuid_template, // uuid_template is just a placeholder and will be replaced by user_id from triggered function lookup from firebase_email
  firebase_email: seeded_user_email, // testing Firebase auth migration trigger
  sense_id: first_entry_first_sense_id,
  sentence_id: first_sentence_id,
  table: 'sentences',
  change: {
    column: 'text',
    new_value: 'Hi, I am a sentence connected to the first sense of the first entry.',
  },
}

const first_sentence_translation_no_sense_id_as_not_needed: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '08',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sentence_id: first_sentence_id,
  table: 'sentences',
  change: {
    column: 'translation',
    new_value: '{"es":"Hola, soy una oración de ejemplo para el primer sentido de la primera entrada."}',
  },
}

const second_sentence_soon_to_be_deleted: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '09',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: first_entry_first_sense_id,
  sentence_id: second_sentence_id,
  table: 'sentences',
  change: {
    column: 'text',
    new_value: 'I am a sentence that will be deleted and should not be in entries_view.',
  },
}

const second_sentence_deleted: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '10',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: first_entry_first_sense_id,
  sentence_id: second_sentence_id,
  table: 'sentences',
  change: {
    column: 'deleted',
    new_value: '2024-02-01T07:13:48.267Z',
  },
}

const third_sentence_attached_to_first_entry_second_sense: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '11',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: first_entry_second_sense_id,
  sentence_id: third_sentence_id,
  table: 'sentences',
  change: {
    column: 'text',
    new_value: 'Hi, I am a sentence initially connected to the second sense of the first entry that is later added to first sense of the second entry and disconnected from original second sense of first entry.',
  },
}

const third_sentence_also_attached_to_second_entry_first_sense: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '12',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: second_entry_first_sense_id,
  sentence_id: third_sentence_id,
  table: 'senses_in_sentences',
  change: {
    action: 'make the connection'
  }
}

const third_sentence_removed_from_original_first_entry_second_sense: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '13',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: first_entry_second_sense_id,
  sentence_id: third_sentence_id,
  table: 'senses_in_sentences',
  change: {
    column: 'deleted',
    new_value: '2023-11-16T07:13:48.267Z',
  },
}

const fourth_sentence_attached_to_first_entry_first_sense: TablesInsert<'content_updates'> = {
  id: uuid_template.slice(0, -2) + '14',
  dictionary_id: seeded_dictionary_id,
  user_id: seeded_user_id,
  sense_id: first_entry_first_sense_id,
  sentence_id: fourth_sentence_id,
  table: 'sentences',
  change: {
    column: 'text',
    new_value: 'Hi, I should be the second sentence connected to the first sense of the first entry.',
  },
}

export const content_updates: TablesInsert<'content_updates'>[] = [
  first_sentence_text_attached_to_first_entry_first_sense,
  first_sentence_translation_no_sense_id_as_not_needed,
  second_sentence_soon_to_be_deleted,
  second_sentence_deleted,
  third_sentence_attached_to_first_entry_second_sense,
  third_sentence_also_attached_to_second_entry_first_sense,
  third_sentence_removed_from_original_first_entry_second_sense,
  fourth_sentence_attached_to_first_entry_first_sense,
]
