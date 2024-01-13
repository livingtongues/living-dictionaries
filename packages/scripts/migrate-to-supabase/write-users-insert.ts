import { UserInfo, UserRecord } from 'firebase-admin/auth';

export function write_users_insert(users: UserRecord[]) {
  const user_sql_rows = users.map(create_user_sql_row)

  return `INSERT INTO auth.users (${user_header()}) VALUES ${user_sql_rows.join(',\n')} ON CONFLICT DO NOTHING;`
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
      'providerData': [{ 'uid': 'robert@me.org', 'email': 'robert@me.org', 'providerId': 'password'  }],
    },
    {'uid':'0FCdmOc6qlWuKxFkKPi7VeC2mp52',
      'email':'bob@gmail.com',
      'emailVerified':true,
      'displayName':'Bob D\'Smith',
      'photoURL':'https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c','disabled':false,
      'metadata':{
        'lastSignInTime':'Fri, 12 Mar 2021 21:04:29 GMT',
        'creationTime':'Tue, 29 Dec 2020 00:08:26 GMT',
        'lastRefreshTime':null
      },
      'tokensValidAfterTime':'Thu, 18 Mar 2021 08:26:40 GMT','providerData':[{'uid':'101321196686998195781','displayName':'Bob Smith','email':'bob@gmail.com','photoURL':'https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c','providerId':'google.com'}]}
  ] as UserRecord[];
  test(write_users_insert, () => {
    expect(write_users_insert(users)).toMatchFileSnapshot('./users.sql');
  });
}

function user_header() {
  return `
instance_id,
id,
aud,
role,
email,
email_confirmed_at,
last_sign_in_at,
raw_app_meta_data,
raw_user_meta_data,
created_at,
updated_at
`;
}

function create_user_sql_row(user: UserRecord) {
  return `('00000000-0000-0000-0000-000000000000', /* instance_id */
  uuid_generate_v4(), /* id */
  'authenticated', /* aud character varying(255),*/
  'authenticated', /* role character varying(255),*/
  '${user.email}', /* email character varying(255),*/
  ${user.emailVerified ? 'NOW()' : 'null'}, /* email_confirmed_at timestamp with time zone,*/
  '${convert_utc_string_to_timestamp(user.metadata.lastSignInTime)}', /* last_sign_in_at timestamp with time zone, */
  '${get_provider_string(user.providerData)}', /* raw_app_meta_data jsonb,*/
  '${get_firebase_metadata_string(user)}', /* raw_user_meta_data jsonb,*/
  '${convert_utc_string_to_timestamp(user.metadata.creationTime)}', /* created_at timestamp with time zone, */
  NOW() /* updated_at timestamp with time zone, */)`;
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

function get_provider_string(firebase_providers: UserInfo[]) {
  const providers = firebase_providers.map(({providerId}) => {
    if (providerId === 'password')
      return 'email';
    if (providerId === 'google.com')
      return 'google';
    return 'email';
  })

  return `{"provider": "${providers[0]}","providers":["${providers.join('","')}"]}`;
}

function get_firebase_metadata_string({displayName, photoURL}: UserRecord) {
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
