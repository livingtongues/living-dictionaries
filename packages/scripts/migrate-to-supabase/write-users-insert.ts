import { UserRecord } from 'firebase-admin/auth';
const POSTGRES_NOW = 'NOW()'
const POSTGRESS_UUID_GENERATE_V4 = 'uuid_generate_v4()'

export function write_users_insert(users: UserRecord[]) {
  const user_rows = users.map(user => {
    return {
      instance_id: '00000000-0000-0000-0000-000000000000',
      id: POSTGRESS_UUID_GENERATE_V4,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: user.emailVerified ? POSTGRES_NOW : null,
      last_sign_in_at: convert_utc_string_to_timestamp(user.metadata.lastSignInTime),
      created_at: convert_utc_string_to_timestamp(user.metadata.creationTime),
      updated_at: POSTGRES_NOW,
      raw_app_meta_data: get_firebase_app_meta_data(user),
      raw_user_meta_data: get_firebase_user_meta_data(user),
    }
  })

  return write_sql_insert('auth.users', user_rows)
}

function write_sql_insert(table_name: string, rows: object[]) {
  const column_names = Object.keys(rows[0]).sort()
  const column_names_string = `"${column_names.join('", "')}"`

  const values_string = rows.map(row => {
    // @ts-expect-error
    const values = column_names.map(column => convert_to_sql_string(row[column]))
    return `(${values.join(', ')})`
  }).join(',\n')

  return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string} ON CONFLICT DO NOTHING;`
}

function convert_to_sql_string(value: string | number | object) {
  if (value === POSTGRES_NOW || value === POSTGRESS_UUID_GENERATE_V4)
    return value;

  if (typeof value === 'boolean')
    return `${value}`
  if (typeof value === 'string')
    return `'${value}'`
  if (typeof value === 'number')
    return `${value}`
  if (Array.isArray(value))
    return `'{${value.join(',')}}'`
  if (!value) // must come here to avoid snatching up 0, empty string, or false, but not after object
    return 'null'
  if (typeof value === 'object')
    return `'${JSON.stringify(value)}'::jsonb`
  throw new Error(`${value} has an unexpected value type: ${typeof value}`)
}

if (import.meta.vitest) {
  const users: UserRecord[] = [
    { 'uid': '024bvoAhcSaAiBfZ8Um2KQaQRc92',
      'email': 'robert@me.org',
      'emailVerified': true,
      'disabled': false,
      'metadata': {
        'lastSignInTime': 'Thu, 08 Jun 2023 04:42:14 GMT',
        'creationTime': 'Thu, 08 Jun 2023 04:42:14 GMT',
        'lastRefreshTime': 'Thu, 08 Jun 2023 04:42:14 GMT',
      },
      'tokensValidAfterTime': 'Thu, 08 Jun 2023 04:42:14 GMT',
      'providerData': [{ 'email': 'robert@me.org', 'providerId': 'password'  }],
    },
    {'uid':'0FCdmOc6qlWuKxFkKPi7VeC2mp52',
      'email':'bob@gmail.com',
      'emailVerified':false,
      'displayName':'Bob D\'Smith',
      'photoURL':'https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c',
      'disabled':false,
      'metadata':{
        'lastSignInTime':'Fri, 12 Mar 2021 21:04:29 GMT',
        'creationTime':'Tue, 29 Dec 2020 00:08:26 GMT',
        'lastRefreshTime':null
      },
      'tokensValidAfterTime':'Thu, 18 Mar 2021 08:26:40 GMT',
      'providerData':[{'displayName':'Bob Smith','email':'bob@gmail.com','photoURL':'https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c','providerId':'google.com'}]}
  ] as UserRecord[];

  test(write_users_insert, () => {
    expect(write_users_insert(users)).toMatchFileSnapshot('./users-js.sql');
  });
}

function convert_utc_string_to_timestamp(dateString: string) {
  const date = new Date(dateString);
  const isoString = date.toISOString();
  return isoString.replace('T', ' ').replace('Z', '1+00'); // if decimal are all zeros as they are in coming from Firebase, postgres will reject the timestamp so we must remove it or add a final 1
}

if (import.meta.vitest) {
  test('times', () => {
    expect(convert_utc_string_to_timestamp('Fri, 12 Mar 2021 21:04:29 GMT')).toEqual('2021-03-12 21:04:29.0001+00');
    expect(convert_utc_string_to_timestamp('Thu, 08 Jun 2023 04:42:14 GMT')).toEqual('2023-06-08 04:42:14.0001+00');
  });
}

function get_firebase_app_meta_data({providerData, uid}: UserRecord) {
  const providers = providerData.map(({providerId}) => {
    if (providerId === 'password')
      return 'email';
    if (providerId === 'google.com')
      return 'google';
    return 'email';
  })

  return `{"provider": "${providers[0]}","providers":["${providers.join('","')}"], "fb_uid": "${uid}"}`;
}

function get_firebase_user_meta_data({displayName, photoURL}: UserRecord) {
  const escapedDisplayName = displayName ? escape_apostrophes(displayName) : '';

  if (!escapedDisplayName && !photoURL)
    return '{}';
  if (!escapedDisplayName)
    return `{"photoURL":"${photoURL}"}`;
  if (!photoURL)
    return `{"displayName": "${escapedDisplayName}"}`;
  return `{"displayName": "${escapedDisplayName}","photoURL":"${photoURL}"}`;
}

function escape_apostrophes(str: string): string {
  return str.replace(/'/g, '\'\'');
}
