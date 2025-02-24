import { jacob_ld_user_id } from '../constants'
import { generate_inserts } from './generate-inserts'

vi.mock('./get-user-id', () => {
  return {
    get_supabase_user_id_from_firebase_uid: () => jacob_ld_user_id,
  }
})

vi.mock('node:crypto', () => {
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0

  function incremental_consistent_uuid() {
    return uuid_template.slice(0, -5) + (current_uuid_index++).toString().padStart(5, '0')
  }

  return {
    randomUUID: incremental_consistent_uuid,
  }
})

test(generate_inserts, () => {
  const sql = generate_inserts({
    dictionary_ids: ['d_id-1', 'd_id-2', 'd_id-3'],
    fb_managers: {
      'd_id-1': [
        { id: '1', name: 'Bob' },
        {
          id: '2',
          name: 'Jim',
          // @ts-expect-error
          createdAt: { _seconds: 123 },
        },
      ],
      'd_id-2': [
        { id: '3', name: 'Alice' },
        { id: '4', name: 'Eve' },
      ],
    },
    fb_contributors: {
      'd_id-1': [
        { id: '5', name: 'Charlie' },
      ],
    },
    fb_writeInCollaborators: {
      'd_id-2': [
        { id: 'not-important', name: 'Dave', createdBy: 'jim', updatedBy: 'jim' },
        { id: 'not-important', name: 'Eve' },
      ],
    },
    fb_partners: {
      'd_id-1': [
        {
          id: 'not-important',
          name: 'Frank',
          logo: { fb_storage_path: 'foo', specifiable_image_url: 'abc' },
          // @ts-expect-error
          createdAt: { _seconds: 123 },
          // @ts-expect-error
          updatedAt: { _seconds: 456 },
        },
        {
          id: 'not-important',
          name: 'George',
        },
      ],
    },
    fb_invites: {
      'd_id-2': [
        {
          id: '8',
          targetEmail: 'foo@g.com',
          role: 'contributor',
          status: 'sent',
          dictionaryName: 'bar',
          inviterEmail: 'g@g.com',
          inviterName: 'h',
        },
      ],
    },
    fb_dictionary_infos: {
      'd_id-1': { about: 'about 1', citation: 'citation 1', createdBy: 'jim', updatedBy: 'jim' },
      'd_id-2': { about: 'about 2', grammar: 'grammar 2' },
    },
  })
  expect(sql).toMatchInlineSnapshot(`
    "INSERT INTO dictionary_roles ("dictionary_id", "role", "user_id") VALUES
    ('d_id-1', 'manager', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_roles ("created_at", "dictionary_id", "role", "user_id") VALUES
    ('1970-01-01T00:02:03.000Z', 'd_id-1', 'manager', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_roles ("dictionary_id", "role", "user_id") VALUES
    ('d_id-1', 'contributor', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO photos ("created_at", "created_by", "dictionary_id", "id", "serving_url", "storage_path", "updated_at", "updated_by") VALUES
    ('1970-01-01T00:02:03.000Z', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', 'd_id-1', '11111111-1111-1111-1111-111111100000', 'abc', 'foo', '1970-01-01T00:07:36.000Z', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_partners ("created_at", "created_by", "dictionary_id", "name", "photo_id", "updated_at", "updated_by") VALUES
    ('1970-01-01T00:02:03.000Z', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', 'd_id-1', 'Frank', '11111111-1111-1111-1111-111111100000', '1970-01-01T00:07:36.000Z', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_partners ("created_by", "dictionary_id", "name", "updated_by") VALUES
    ('de2d3715-6337-45a3-a81a-d82c3210b2a7', 'd_id-1', 'George', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_info ("about", "citation", "created_by", "id", "updated_by") VALUES
    ('about 1', 'citation 1', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', 'd_id-1', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_roles ("dictionary_id", "role", "user_id") VALUES
    ('d_id-2', 'manager', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO dictionary_roles ("dictionary_id", "role", "user_id") VALUES
    ('d_id-2', 'manager', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');
    INSERT INTO invites ("created_by", "dictionary_id", "inviter_email", "role", "status", "target_email") VALUES
    ('de2d3715-6337-45a3-a81a-d82c3210b2a7', 'd_id-2', 'g@g.com', 'contributor', 'sent', 'foo@g.com');
    INSERT INTO dictionary_info ("about", "created_by", "grammar", "id", "updated_by", "write_in_collaborators") VALUES
    ('about 2', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', 'grammar 2', 'd_id-2', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', '{Dave,Eve}');
    "
  `)
})
