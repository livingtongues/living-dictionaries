// vps-migration: stable IDs for the dummy entry/speaker fixtures (dummy-entries.ts)
// and the stub Supabase client's dummy `dictionary_roles` row. The real auth +
// dictionary_roles now live in SQLite (M4-auth); these are only seed/fixture ids.
// The seeded e2e achi-manager uses this same id (see scripts/seed-achi-fixture.ts).
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_MANAGED_DICTIONARY_ID = 'achi'
