// import type {  } from '$lib/supabase/database.types'
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

const dictionary_id = 'dictionary1'

const first_entry_id = 'entry1'
const first_entry_first_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001'
const first_entry_second_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002'
const first_entry_third_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003'

const second_entry_id = 'entry2';
const second_entry_first_sense_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011';

const first_entry_first_sense_text_field: TablesInsert<'entry_updates'> = {
  id: uuid_template.slice(0, -2) + '01',
  user_id: seeded_user_id,
  dictionary_id,
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
  dictionary_id,
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
  dictionary_id,
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
  dictionary_id,
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
  dictionary_id,
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
  dictionary_id,
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

const first_example_sentence_id = uuid_template.slice(0, -2) + 'a1'

export const sentence_updates: TablesInsert<'sentence_updates'>[] = [
  {
    id: uuid_template.slice(0, -2) + '07',
    dictionary_id,
    user_id: seeded_user_id,
    sense_id: first_entry_first_sense_id,
    sentence_id: first_example_sentence_id,
    table: 'sentences',
    column: 'text',
    new_value: 'Hi, I am an example sentence for the first sense of the first entry.',
  },
  {
    id: uuid_template.slice(0, -2) + '08',
    dictionary_id,
    user_id: seeded_user_id,
    sense_id: first_entry_first_sense_id,
    sentence_id: first_example_sentence_id,
    table: 'sentences',
    column: 'translation',
    new_value: '{"es":"Hola, soy una oración de ejemplo para el primer sentido de la primera entrada."}',
  },

  // TODO: delete example sentence and make sure not in entries_view
  // TODO: add to additional sense
  // TODO: delete from original sense
]
