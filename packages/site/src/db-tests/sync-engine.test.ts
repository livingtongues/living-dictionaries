/* eslint-disable test/no-conditional-in-test */
import type { Database } from '@living-dictionaries/types'
import * as local_schema from '$lib/pglite/schema'
import { Sync } from '$lib/pglite/sync/sync-engine.svelte.js'
import { PGlite } from '@electric-sql/pglite'
import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { admin_supabase, anon_supabase, generate_uuid, PASSWORD, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL, supabase_pg } from './sync-clients'

vi.mock('$app/state', () => ({
  page: {
    url: {},
  },
}))

const TEST_USER_ID = generate_uuid(1)
const TEST_USER_EMAIL = `test-${TEST_USER_ID}@test.com`

const DICTIONARY_ID_1 = 'test-dict-1'
const USER_ID_1 = generate_uuid(11)
const INVITE_ID = generate_uuid(13)

const local_migrations = import.meta.glob(['$lib/pglite/migrations/*.sql'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function combine_migrations(migrations: Record<string, string>): string {
  return Object.entries(migrations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, sql]) => sql)
    .join('\n')
}

const local_migration_sql = combine_migrations(local_migrations)

type LocalDb = ReturnType<typeof drizzle<typeof local_schema>>

interface Device {
  pg: PGlite
  db: LocalDb
  sync: Sync
}

async function create_device(): Promise<Device> {
  const pg = new PGlite()
  const db = drizzle(pg, { schema: local_schema })
  await pg.exec(local_migration_sql)
  const sync = new Sync(db, pg, anon_supabase)
  return { pg, db, sync }
}

const reset_supabase_admin_data_sql = `
  DELETE FROM deletes;
  DELETE FROM dictionary_roles;
  DELETE FROM invites;
  DELETE FROM user_data;
  DELETE FROM dictionaries;
  -- DELETE FROM auth.users;
`

describe(Sync, () => {
  beforeAll(async () => {
    // main user
    await admin_supabase.auth.admin.createUser({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { admin: 1 },
    })
    await anon_supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: PASSWORD,
    })

    // secondary user
    await admin_supabase.auth.admin.createUser({
      id: USER_ID_1,
      email: `test-${USER_ID_1}@test.com`,
      password: PASSWORD,
      email_confirm: true,
    })
  })

  describe('multi-device sync - dictionaries and users', () => {
    let device1: Device
    let device2: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device1 = await create_device()
    })

    afterAll(async () => {
      await device1?.pg.close()
      await device2?.pg.close()
    })

    test('1. Device downloads user and dictionary from cloud', async () => {
      await anon_supabase.from('dictionaries').upsert({
        id: DICTIONARY_ID_1,
        url: DICTIONARY_ID_1,
        name: 'Test Dictionary',
      })

      const result = await device1.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_downloaded).toBeGreaterThanOrEqual(5) // 2 users, 1 dictionary, 1 dictionary_role, 1 user_data

      // Verify the test user is present
      const [test_user] = await device1.db.select().from(local_schema.users).where(eq(local_schema.users.id, TEST_USER_ID))
      expect(test_user).toBeDefined()
      expect(test_user.email).toBe(TEST_USER_EMAIL)

      // Verify dictionaries table has data
      const [dict] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(dict.name).toBe('Test Dictionary')
      expect(dict.local_saved_at).toBeNull()

      // Verify metadata is set after first sync
      const metadata = await device1.db.select().from(local_schema.db_metadata)
      const synced_up_to = metadata.find(m => m.key === 'synced_up_to')
      const last_synced_at = metadata.find(m => m.key === 'last_synced_at')
      expect(synced_up_to?.value).toBeDefined()
      expect(last_synced_at?.value).toBeDefined()
    })

    test('2. Edit dictionary locally and sync up, local_saved_at cleared', async () => {
      await device1.db.update(local_schema.dictionaries)
        .set({
          public: true,
        })
        .where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))

      // Verify local_saved_at is set
      const [dict] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(dict.local_saved_at).not.toBeNull()

      const result = await device1.sync.sync()

      if (!result.success) {
        console.error('Sync errors:', result.errors)
      }
      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBe(1)
      expect(result.items_downloaded).toBe(0)

      // Verify cloud dictionary updated
      const { data: cloud_dict } = await admin_supabase
        .from('dictionaries')
        .select('*')
        .eq('id', DICTIONARY_ID_1)
        .single()
      expect(cloud_dict.public).toBeTruthy()

      // Verify local_saved_at is now NULL (synced state)
      const [synced_dict] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(synced_dict.local_saved_at).toBeNull()

      // Verify synced_up_to advanced (upload returns new updated_at from Supabase)
      const [synced_up_to] = await device1.db.select().from(local_schema.db_metadata).where(eq(local_schema.db_metadata.key, 'synced_up_to'))
      expect(new Date(synced_up_to.value).getTime()).toBeGreaterThan(new Date(synced_dict.updated_at!).getTime() - 1000)
    })

    test('3. Device 2 syncs and downloads from cloud', async () => {
      device2 = await create_device()

      const result = await device2.sync.sync()

      expect(result.success).toBeTruthy()

      // Verify device2 has the dictionary
      const [dict] = await device2.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(dict).toBeDefined()
      expect(dict.name).toBe('Test Dictionary')
      expect(dict.local_saved_at).toBeNull()
    })

    test('4. Device 2 edits a different field on the dictionary and syncs up', async () => {
      await device2.db.update(local_schema.dictionaries)
        .set({ url: 'updated-url-from-device2' })
        .where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))

      const result = await device2.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBe(1)

      // Verify cloud dictionary updated
      const { data: cloud_dict } = await admin_supabase
        .from('dictionaries')
        .select('*')
        .eq('id', DICTIONARY_ID_1)
        .single()
      expect(cloud_dict.url).toBe('updated-url-from-device2')
    })

    test('5. Device 1 syncs down the change from Device 2', async () => {
      // Capture synced_up_to before sync
      const [before] = await device1.db.select().from(local_schema.db_metadata).where(eq(local_schema.db_metadata.key, 'synced_up_to'))
      const before_ts = new Date(before.value).getTime()

      const result = await device1.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_downloaded).toBe(1)

      // Verify device1 now has the updated url from device2
      const [dict] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(dict.url).toBe('updated-url-from-device2')
      expect(dict.local_saved_at).toBeNull()

      // Verify synced_up_to advanced after downloading new changes
      const [after] = await device1.db.select().from(local_schema.db_metadata).where(eq(local_schema.db_metadata.key, 'synced_up_to'))
      expect(new Date(after.value).getTime()).toBeGreaterThan(before_ts)
    })

    test('6. local_saved_at advances on each save', async () => {
      await device1.db.update(local_schema.dictionaries)
        .set({ name: 'First Name Change' })
        .where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))

      const [after_first] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      expect(after_first.local_saved_at).not.toBeNull()
      const first_saved_at = new Date(after_first.local_saved_at!).getTime()

      await new Promise(resolve => setTimeout(resolve, 20))

      await device1.db.update(local_schema.dictionaries)
        .set({ name: 'Second Name Change' })
        .where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))

      const [after_second] = await device1.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DICTIONARY_ID_1))
      const second_saved_at = new Date(after_second.local_saved_at!).getTime()
      expect(second_saved_at).toBeGreaterThan(first_saved_at)
    })
  })

  describe('conflict resolution (last-write-wins)', () => {
    const CONFLICT_DICT_ID = 'test-conflict-dict'
    let device1: Device
    let device2: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device1 = await create_device()
      device2 = await create_device()
    })

    afterAll(async () => {
      await device1?.pg.close()
      await device2?.pg.close()
    })

    const UPDATED_DEVICE_2_NAME = 'Updated by Device 2'

    test('local change newer than cloud - local wins, uploads to cloud', async () => {
      // Device 1 creates dictionary and syncs
      await device1.db.insert(local_schema.dictionaries).values({
        id: CONFLICT_DICT_ID,
        name: 'Original Name',
        public: false,
        url: CONFLICT_DICT_ID,
        created_by: TEST_USER_ID,
        created_at: new Date(),
        updated_at: new Date(),
      })
      await device1.sync.sync()

      // Device 2 syncs to get the original
      await device2.sync.sync()

      // Device 1 updates and syncs
      await device1.db.update(local_schema.dictionaries)
        .set({ name: 'Updated by Device 1' })
        .where(eq(local_schema.dictionaries.id, CONFLICT_DICT_ID))
      await device1.sync.sync()

      // Small delay to ensure timestamps differ
      await new Promise(resolve => setTimeout(resolve, 10))

      // Device 2 updates (will have newer local_saved_at)
      await device2.db.update(local_schema.dictionaries)
        .set({ name: UPDATED_DEVICE_2_NAME })
        .where(eq(local_schema.dictionaries.id, CONFLICT_DICT_ID))

      // Device 2 syncs - should upload
      const result = await device2.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBe(1)

      // Verify cloud has device 2's update
      const { data } = await admin_supabase
        .from('dictionaries')
        .select('*')
        .eq('id', CONFLICT_DICT_ID)
        .single()
      expect(data?.name).toBe(UPDATED_DEVICE_2_NAME)
    })

    test('cloud change newer than local - cloud wins, downloads to local', async () => {
      // Device 1 makes change but doesn't sync yet
      await device1.db.update(local_schema.dictionaries)
        .set({ name: 'will be overwritten by newer cloud update' })
        .where(eq(local_schema.dictionaries.id, CONFLICT_DICT_ID))

      // Device 2 makes change and syncs to upload to cloud (this will be newer)
      await device2.db.update(local_schema.dictionaries)
        .set({ name: UPDATED_DEVICE_2_NAME })
        .where(eq(local_schema.dictionaries.id, CONFLICT_DICT_ID))
      await device2.sync.sync()

      // Device 1 syncs - cloud is newer, should download
      const result = await device1.sync.sync()
      expect(result.success).toBeTruthy()
      expect(result.items_downloaded).toBe(1)
      expect(result.items_uploaded).toBe(0)

      // Verify device 1 has the cloud update
      const [dict] = await device1.db.select()
        .from(local_schema.dictionaries)
        .where(eq(local_schema.dictionaries.id, CONFLICT_DICT_ID))
      expect(dict.name).toBe(UPDATED_DEVICE_2_NAME)
    })
  })

  describe('error handling', () => {
    let device: Device

    beforeAll(async () => {
      device = await create_device()
    })

    afterAll(async () => {
      await device?.pg.close()
    })

    test('sync already in progress throws error', async () => {
      const sync_promise = device.sync.sync()

      await expect(device.sync.sync()).rejects.toThrowError('Sync already in progress')

      await sync_promise
    })
  })

  describe('users table is read-only', () => {
    let device: Device

    beforeAll(async () => {
      device = await create_device()
      await device.sync.sync() // Get initial data
    })

    afterAll(async () => {
      await device?.pg.close()
    })

    test('local changes to users table are not uploaded', async () => {
      // Modify user locally
      await device.db.update(local_schema.users)
        .set({ full_name: 'Modified Name' })
        .where(eq(local_schema.users.id, TEST_USER_ID))

      const result = await device.sync.sync()

      // Should not upload because users is read-only
      expect(result.items_uploaded).toBe(0)
    })
  })

  describe('dictionary_roles sync', () => {
    const ROLE_DICT_ID = 'role-test-dict'
    let device: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device = await create_device()

      // Create a dictionary in Supabase for the role to reference
      await anon_supabase.from('dictionaries').upsert({
        id: ROLE_DICT_ID,
        url: ROLE_DICT_ID,
        name: 'Role Test Dictionary',
      })
    })

    afterAll(async () => {
      await device?.pg.close()
    })

    test('downloads dictionary_roles from cloud', async () => {
      // Create a role in Supabase
      await admin_supabase.from('dictionary_roles').upsert({
        dictionary_id: ROLE_DICT_ID,
        user_id: TEST_USER_ID,
        role: 'manager',
      })

      const result = await device.sync.sync()

      if (!result.success) {
        console.error('Sync errors:', result.errors)
      }
      expect(result.success).toBeTruthy()

      // Verify dictionary_roles table has data
      const roles = await device.db.select().from(local_schema.dictionary_roles).where(eq(local_schema.dictionary_roles.dictionary_id, ROLE_DICT_ID))
      expect(roles).toHaveLength(1)
      expect(roles[0].dictionary_id).toBe(ROLE_DICT_ID)
      expect(roles[0].user_id).toBe(TEST_USER_ID)
      expect(roles[0].role).toBe('manager')
      expect(roles[0].local_saved_at).toBeNull()
    })

    test('uploads new dictionary_role to cloud', async () => {
      // First sync to get the dictionary
      await device.sync.sync()

      // Add a contributor role locally
      await device.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: ROLE_DICT_ID,
        user_id: USER_ID_1,
        role: 'contributor',
        created_at: new Date(),
      })

      const result = await device.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBe(1)

      // Verify cloud has the new role
      const { data: cloud_roles } = await admin_supabase
        .from('dictionary_roles')
        .select('*')
        .eq('dictionary_id', ROLE_DICT_ID)
        .eq('user_id', USER_ID_1)
      expect(cloud_roles).toHaveLength(1)
      expect(cloud_roles![0].role).toBe('contributor')
    })
  })

  describe('invites sync', () => {
    const INVITE_DICT_ID = 'invite-test-dict'
    let device: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device = await create_device()

      // Create a dictionary in Supabase for the invite to reference
      await anon_supabase.from('dictionaries').upsert({
        id: INVITE_DICT_ID,
        url: INVITE_DICT_ID,
        name: 'Invite Test Dictionary',
      })
    })

    afterAll(async () => {
      await device?.pg.close()
    })

    test('downloads invites from cloud', async () => {
      // Create an invite in Supabase
      await admin_supabase.from('invites').upsert({
        id: INVITE_ID,
        dictionary_id: INVITE_DICT_ID,
        created_by: TEST_USER_ID,
        inviter_email: TEST_USER_EMAIL,
        target_email: 'invited@test.com',
        role: 'contributor',
        status: 'queued',
      })

      const result = await device.sync.sync()

      expect(result.success).toBeTruthy()

      // Verify invites table has the specific invite
      const [invite] = await device.db.select().from(local_schema.invites).where(eq(local_schema.invites.id, INVITE_ID))
      expect(invite).toBeDefined()
      expect(invite.dictionary_id).toBe(INVITE_DICT_ID)
      expect(invite.target_email).toBe('invited@test.com')
      expect(invite.status).toBe('queued')
      expect(invite.local_saved_at).toBeNull()
    })

    test('uploads new invite to cloud', async () => {
      // First sync to get existing data
      await device.sync.sync()

      const new_invite_id = generate_uuid(20)

      // Create a new invite locally
      await device.db.insert(local_schema.invites).values({
        id: new_invite_id,
        dictionary_id: INVITE_DICT_ID,
        created_by: TEST_USER_ID,
        inviter_email: TEST_USER_EMAIL,
        target_email: 'new-invite@test.com',
        role: 'manager',
        status: 'queued',
        created_at: new Date(),
      })

      const result = await device.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBe(1)

      // Verify cloud has the new invite
      const { data: cloud_invite } = await admin_supabase
        .from('invites')
        .select('*')
        .eq('id', new_invite_id)
        .single()
      expect(cloud_invite).toBeDefined()
      expect(cloud_invite!.target_email).toBe('new-invite@test.com')
      expect(cloud_invite!.role).toBe('manager')
    })
  })

  describe('delete synchronization', () => {
    const DELETE_DICT_ID = 'delete-test-dict'
    const DELETE_INVITE_ID = generate_uuid(30)
    let device1: Device
    let device2: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device1 = await create_device()
      device2 = await create_device()
    })

    afterAll(async () => {
      await device1?.pg.close()
      await device2?.pg.close()
    })

    test('dictionary delete syncs to cloud and cascades to other devices', async () => {
      // Device 1 creates dictionary and syncs
      await device1.db.insert(local_schema.dictionaries).values({
        id: DELETE_DICT_ID,
        name: 'Dictionary to Delete',
        url: DELETE_DICT_ID,
        created_by: TEST_USER_ID,
        created_at: new Date(),
        updated_at: new Date(),
      })
      await device1.sync.sync()

      // Device 2 syncs to get the dictionary
      await device2.sync.sync()
      const before = await device2.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DELETE_DICT_ID))
      expect(before).toHaveLength(1)

      // Device 1 deletes the dictionary locally by recording the delete in the deletes table
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'dictionaries',
        id: DELETE_DICT_ID,
      })

      const delete_result = await device1.sync.sync()
      expect(delete_result.success).toBeTruthy()
      expect(delete_result.deletes_pushed).toBe(1)

      // Device 2 syncs - should pull the delete
      const result = await device2.sync.sync()
      expect(result.success).toBeTruthy()
      expect(result.deletes_pulled).toBe(1)

      // Verify device 2 no longer has the dictionary
      const after = await device2.db.select().from(local_schema.dictionaries).where(eq(local_schema.dictionaries.id, DELETE_DICT_ID))
      expect(after).toHaveLength(0)
    })

    test('dictionary_roles delete with composite PK syncs correctly', async () => {
      // Create dictionary and role in cloud
      await anon_supabase.from('dictionaries').upsert({
        id: 'role-delete-dict',
        url: 'role-delete-dict',
        name: 'Role Delete Test',
      })
      await admin_supabase.from('dictionary_roles').upsert({
        dictionary_id: 'role-delete-dict',
        user_id: TEST_USER_ID,
        role: 'manager',
      })

      // Both devices sync to get the data
      await device1.sync.sync()
      await device2.sync.sync()

      // Verify device 2 has the role
      const [role] = await device2.db.select().from(local_schema.dictionary_roles).where(eq(local_schema.dictionary_roles.dictionary_id, 'role-delete-dict'))
      expect(role.role).toBe('manager')

      // Device 1 deletes the role using composite key format: dictionary_id|user_id|role
      const composite_key = `role-delete-dict|${TEST_USER_ID}|manager`
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'dictionary_roles',
        id: composite_key,
      })

      const push_result = await device1.sync.sync()
      expect(push_result.errors).toHaveLength(0)
      expect(push_result.deletes_pushed).toBe(1)

      // Device 2 syncs - should pull the delete
      const result = await device2.sync.sync()
      expect(result.deletes_pulled).toBe(1)

      // Verify device 2 no longer has the role
      const after = await device2.db.select().from(local_schema.dictionary_roles).where(eq(local_schema.dictionary_roles.dictionary_id, 'role-delete-dict'))
      expect(after).toHaveLength(0)
    })

    test('invite delete syncs to cloud and cascades to other devices', async () => {
      // Create dictionary and invite in cloud
      await anon_supabase.from('dictionaries').upsert({
        id: 'invite-delete-dict',
        url: 'invite-delete-dict',
        name: 'Invite Delete Test',
      })
      await admin_supabase.from('invites').upsert({
        id: DELETE_INVITE_ID,
        dictionary_id: 'invite-delete-dict',
        created_by: TEST_USER_ID,
        inviter_email: TEST_USER_EMAIL,
        target_email: 'delete-test@test.com',
        role: 'contributor',
        status: 'queued',
      })

      // Both devices sync
      await device1.sync.sync()
      await device2.sync.sync()

      // Verify device 2 has the invite
      const before = await device2.db.select().from(local_schema.invites).where(eq(local_schema.invites.id, DELETE_INVITE_ID))
      expect(before).toHaveLength(1)

      // Device 1 deletes the invite
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'invites',
        id: DELETE_INVITE_ID,
      })

      await device1.sync.sync()

      // Device 2 syncs - should pull the delete
      const result = await device2.sync.sync()
      expect(result.deletes_pulled).toBe(1)

      // Verify device 2 no longer has the invite
      const after = await device2.db.select().from(local_schema.invites).where(eq(local_schema.invites.id, DELETE_INVITE_ID))
      expect(after).toHaveLength(0)
    })
  })

  describe('deletes table RLS - non-admin cannot insert', () => {
    const NON_ADMIN_USER_ID = generate_uuid(40)
    const NON_ADMIN_EMAIL = `non-admin-${NON_ADMIN_USER_ID}@test.com`
    let non_admin_supabase: typeof anon_supabase

    beforeAll(async () => {
      // Create a non-admin user
      await admin_supabase.auth.admin.createUser({
        id: NON_ADMIN_USER_ID,
        email: NON_ADMIN_EMAIL,
        password: PASSWORD,
        email_confirm: true,
        // No admin metadata
      })

      // Create a separate Supabase client and sign in as non-admin
      non_admin_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)
      await non_admin_supabase.auth.signInWithPassword({
        email: NON_ADMIN_EMAIL,
        password: PASSWORD,
      })
    })

    test('non-admin user cannot insert into deletes table', async () => {
      const { error } = await non_admin_supabase.from('deletes' as any).insert({
        table_name: 'dictionaries',
        id: 'should-not-be-allowed',
      })

      expect(error).toBeDefined()
      expect(['42501', 'PGRST205']).toContain(error.code) // PostgreSQL insufficient privilege or Supabase permission denied
    })
  })

  describe('user_data sync', () => {
    let device: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      // Re-create user_data for test user (deleted by reset)
      await supabase_pg.execute_query(`
        INSERT INTO user_data (id, updated_at) VALUES ('${TEST_USER_ID}', NOW())
        ON CONFLICT (id) DO NOTHING
      `)
      device = await create_device()
    })

    afterAll(async () => {
      await device?.pg.close()
    })

    test('downloads user_data from cloud (auto-created by Supabase trigger)', async () => {
      // user_data is automatically created by Supabase trigger when user is created
      // The test user was created in beforeAll, so user_data should exist
      const result = await device.sync.sync()

      expect(result.success).toBeTruthy()

      // Verify user_data was downloaded
      const user_data = await device.db.select().from(local_schema.user_data).where(eq(local_schema.user_data.id, TEST_USER_ID))
      expect(user_data).toHaveLength(1)
      expect(user_data[0].id).toBe(TEST_USER_ID)
    })

    test('uploads user_data changes to cloud', async () => {
      // First sync to get the user_data locally
      await device.sync.sync()

      // Update user_data locally
      const terms_date = new Date('2025-01-15T10:00:00Z')
      await device.db.update(local_schema.user_data)
        .set({
          terms_agreement: terms_date,
        })
        .where(eq(local_schema.user_data.id, TEST_USER_ID))

      const result = await device.sync.sync()

      expect(result.success).toBeTruthy()
      expect(result.items_uploaded).toBeGreaterThanOrEqual(1)

      // Verify cloud has the update
      const { data: cloud_data } = await admin_supabase
        .from('user_data' as any)
        .select('*')
        .eq('id', TEST_USER_ID)
        .single() as any
      expect(cloud_data).toBeDefined()
      expect(new Date(cloud_data!.terms_agreement!).toISOString()).toBe(terms_date.toISOString())
    })
  })

  describe('delete edge cases', () => {
    const EDGE_DICT_ID = 'edge-case-dict'
    let device1: Device
    let device2: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device1 = await create_device()
      device2 = await create_device()

      // Create dictionary in cloud for roles to reference
      await anon_supabase.from('dictionaries').upsert({
        id: EDGE_DICT_ID,
        url: EDGE_DICT_ID,
        name: 'Edge Case Dictionary',
      })

      // Both devices sync to get initial data
      await device1.sync.sync()
      await device2.sync.sync()
    })

    afterAll(async () => {
      await device1?.pg.close()
      await device2?.pg.close()
    })

    test('delete, re-add, and delete again before sync does not violate unique constraint', async () => {
    // Add a role locally and sync to cloud
      await device1.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: EDGE_DICT_ID,
        user_id: USER_ID_1,
        role: 'contributor',
        created_at: new Date(),
      })
      await device1.sync.sync()

      // Delete the role (inserts into deletes table, trigger removes from dictionary_roles)
      const composite_key = `${EDGE_DICT_ID}|${USER_ID_1}|contributor`
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'dictionary_roles',
        id: composite_key,
      })

      // Re-add the same role
      await device1.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: EDGE_DICT_ID,
        user_id: USER_ID_1,
        role: 'contributor',
      })

      // Delete again - second insert into deletes with same PK should not throw
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'dictionary_roles',
        id: composite_key,
      })

      // Now sync everything
      const result = await device1.sync.sync()
      expect(result.success).toBeTruthy()
      expect(result.errors).toHaveLength(0)
      expect(result.deletes_pushed).toBe(1)

      // Verify the role is gone from cloud
      const { data: cloud_roles } = await admin_supabase
        .from('dictionary_roles')
        .select('*')
        .eq('dictionary_id', EDGE_DICT_ID)
        .eq('user_id', USER_ID_1)
      expect(cloud_roles).toHaveLength(0)

      // Device 2 syncs and should also have no role
      await device2.sync.sync()
      const roles = await device2.db.select()
        .from(local_schema.dictionary_roles)
        .where(eq(local_schema.dictionary_roles.dictionary_id, EDGE_DICT_ID))
      expect(roles.filter(r => r.user_id === USER_ID_1)).toHaveLength(0)
    })

    test('delete and re-add before sync preserves re-added row', async () => {
    // Add a role locally and sync to cloud
      await device1.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: EDGE_DICT_ID,
        user_id: USER_ID_1,
        role: 'manager',
        created_at: new Date(),
      })
      await device1.sync.sync()

      // Delete the role (this inserts into deletes table, trigger removes from dictionary_roles)
      const composite_key = `${EDGE_DICT_ID}|${USER_ID_1}|manager`
      await device1.db.insert(local_schema.deletes).values({
        table_name: 'dictionary_roles',
        id: composite_key,
      })

      // Re-add the same role BEFORE syncing
      await device1.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: EDGE_DICT_ID,
        user_id: USER_ID_1,
        role: 'manager',
        created_at: new Date(),
      })

      // Sync - should handle both the delete and the re-add
      const result = await device1.sync.sync()
      expect(result.success).toBeTruthy()

      // The re-added role should exist in cloud after sync
      const { data: cloud_roles } = await admin_supabase
        .from('dictionary_roles')
        .select('*')
        .eq('dictionary_id', EDGE_DICT_ID)
        .eq('user_id', USER_ID_1)
        .eq('role', 'manager')
      expect(cloud_roles).toHaveLength(1)
    })
  })

  describe('stale delete does not wipe re-added role on new device', () => {
    const STALE_DICT_ID = 'stale-delete-dict'
    let device1: Device
    let device2: Device
    let device3: Device

    beforeAll(async () => {
      await supabase_pg.execute_query(reset_supabase_admin_data_sql)
      device1 = await create_device()
      device2 = await create_device()
      device3 = await create_device()

      await anon_supabase.from('dictionaries').upsert({
        id: STALE_DICT_ID,
        url: STALE_DICT_ID,
        name: 'Stale Delete Test',
      })

      // All devices sync to get the dictionary
      await device1.sync.sync()
      await device2.sync.sync()
      await device3.sync.sync()
    })

    afterAll(async () => {
      await device1?.pg.close()
      await device2?.pg.close()
      await device3?.pg.close()
    })

    test('re-added role survives stale delete from cloud', async () => {
      // Step 1: Device 1 adds a role and syncs
      await device1.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: STALE_DICT_ID,
        user_id: USER_ID_1,
        role: 'manager',
        created_at: new Date(),
      })
      const d1_result = await device1.sync.sync()
      expect(d1_result.errors).toHaveLength(0)

      // Step 2: Device 2 syncs (pulls the role)
      await device2.sync.sync()
      const d2_roles = await device2.db.select()
        .from(local_schema.dictionary_roles)
        .where(eq(local_schema.dictionary_roles.dictionary_id, STALE_DICT_ID))
      expect(d2_roles.filter(r => r.user_id === USER_ID_1 && r.role === 'manager')).toHaveLength(1)

      // Step 3: Device 2 deletes the role and syncs
      const composite_key = `${STALE_DICT_ID}|${USER_ID_1}|manager`
      await device2.db.insert(local_schema.deletes).values({
        table_name: 'dictionary_roles',
        id: composite_key,
      })
      const d2_delete_result = await device2.sync.sync()
      expect(d2_delete_result.errors).toHaveLength(0)
      expect(d2_delete_result.deletes_pushed).toBe(1)

      // Step 4: Device 3 syncs (pulls the delete, no role locally)
      const d3_first_result = await device3.sync.sync()
      expect(d3_first_result.errors).toHaveLength(0)

      // Step 5: Device 3 adds the same role locally
      await device3.db.insert(local_schema.dictionary_roles).values({
        dictionary_id: STALE_DICT_ID,
        user_id: USER_ID_1,
        role: 'manager',
        created_at: new Date(),
      })

      // Step 6: Device 3 syncs - the re-added role should survive
      const d3_second_result = await device3.sync.sync()
      expect(d3_second_result.errors).toHaveLength(0)

      // The role should still exist locally on device 3
      const d3_roles = await device3.db.select()
        .from(local_schema.dictionary_roles)
        .where(eq(local_schema.dictionary_roles.dictionary_id, STALE_DICT_ID))
      expect(d3_roles.filter(r => r.user_id === USER_ID_1)).toHaveLength(1)
      expect(d3_roles.filter(r => r.user_id === USER_ID_1)[0].role).toBe('manager')

      // The role should have been pushed to cloud
      const { data: cloud_roles } = await admin_supabase
        .from('dictionary_roles')
        .select('*')
        .eq('dictionary_id', STALE_DICT_ID)
        .eq('user_id', USER_ID_1)
      expect(cloud_roles).toHaveLength(1)
    })
  })
})
