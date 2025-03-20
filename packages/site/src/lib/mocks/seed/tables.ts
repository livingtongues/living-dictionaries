import type { TablesInsert } from '@living-dictionaries/types'

export const seeded_user_id_1 = 'de2d3715-6337-45a3-a81a-d82c3210b2a7'
export const seeded_user_id_2 = 'be43b1dd-6c64-494d-b5da-10d70c384433'
export const seed_user_email_1 = 'jacob@livingtongues.org'
const seeded_user_email_2 = 'diego@livingtongues.org'

export const users = [
  {
    id: seeded_user_id_1,
    email: seed_user_email_1,
    instance_id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
  },
  {
    id: seeded_user_id_2,
    email: seeded_user_email_2,
    instance_id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
  },
]

export const seeded_dictionary_id = 'dictionary1'

export const seed_dictionaries: TablesInsert<'dictionaries'>[] = [{
  id: seeded_dictionary_id,
  url: seeded_dictionary_id,
  name: 'Test Dictionary',
  created_by: seeded_user_id_1,
  updated_by: seeded_user_id_1,
}]

export const first_entry_id = 'entry1'
const second_entry_id = 'entry2'

export const seed_entries: TablesInsert<'entries'>[] = [
  {
    id: first_entry_id,
    lexeme: {
      lo1: 'lexeme 1 placeholder',
    },
    dictionary_id: seeded_dictionary_id,
    created_by: seeded_user_id_1,
    updated_by: seeded_user_id_1,
  },
  {
    id: second_entry_id,
    lexeme: {
      lo1: 'lexeme 2 placeholder',
    },
    dictionary_id: seeded_dictionary_id,
    created_by: seeded_user_id_1,
    updated_by: seeded_user_id_1,
  },
]
