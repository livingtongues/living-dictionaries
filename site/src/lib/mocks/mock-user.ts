import type { AuthResponse, User } from '@supabase/supabase-js'

// vps-migration dev mock: a logged-in user who MANAGES the `achi` dictionary, so manager/editor
// interactions (edit fields, add/delete senses, settings) can be exercised while the real auth +
// db are still stubbed. Wired in: `getSession` (supabase/index.ts) returns `mock_auth_response`,
// and the stub client (supabase/stub-client.ts) answers `dictionary_roles` for this user.
// Remove (back to logged-out) by reverting those two call sites. The dictionary id is also used
// by the stub's `dictionary_roles` dummy row.
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_MANAGED_DICTIONARY_ID = 'achi'

export const mock_user = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'mock@livingdictionaries.app',
  app_metadata: { provider: 'email', admin: 0 },
  user_metadata: { full_name: 'Mock Manager', avatar_url: '' },
  created_at: '2024-01-01T00:00:00Z',
} as unknown as User

export const mock_auth_response = {
  data: {
    user: mock_user,
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 9999999999,
      user: mock_user,
    },
  },
  error: null,
} as unknown as AuthResponse
