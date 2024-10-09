import type { TablesInsert } from '@living-dictionaries/types'

export const seeded_user_id_1 = '12345678-abcd-efab-cdef-123456789012'
export const seeded_user_id_2 = '12345678-abcd-efab-cdef-123456789013'
export const seed_user_email_1 = 'jacob@livingtongues.org'

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
    email: 'diego@livingtongues.org',
    instance_id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
  },
]

export const seeded_dictionary_id = 'dictionary1'

export const seed_dictionaries: TablesInsert<'dictionaries'>[] = [{
  id: seeded_dictionary_id,
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
