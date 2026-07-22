import type { TranslateRow } from '$lib/server/i18n/i18n-db'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { AuthUser } from '$lib/auth/user.svelte'
import { translate_store } from '$lib/translate/translate-store.svelte'

// The page reads everything off the `translate_store` singleton (rows come
// from an API the story harness can't reach) — chat-stories pattern: module
// scope seeds it; the store is $state so it just renders.
function row(overrides: Partial<TranslateRow> & Pick<TranslateRow, 'key_id' | 'en_value'>): TranslateRow {
  return {
    en_updated_at: '2026-07-01T00:00:00Z',
    value: null,
    source: null,
    needs_review: null,
    updated_at: null,
    updated_by_name: null,
    ...overrides,
  }
}

translate_store.locale = 'es'
translate_store.loading = false
translate_store.rows = [
  row({ key_id: 'misc.add', en_value: 'Add', value: 'Agregar', source: 'human', updated_at: '2026-06-20T10:00:00Z', updated_by_name: 'Tina Translator' }),
  row({ key_id: 'misc.edit', en_value: 'Edit' }),
  row({ key_id: 'misc.invalid_url', en_value: 'Enter a valid URL like {url}', value: 'Ingrese una URL válida', source: 'ai', needs_review: 'ai', updated_at: '2026-07-02T10:00:00Z', updated_by_name: 'AI' }),
  row({ key_id: 'header.contact_us', en_value: 'Contact us', value: 'Contáctenos', source: 'human', needs_review: 'en_changed', updated_at: '2025-11-02T10:00:00Z', updated_by_name: 'Tina Translator' }),
  row({ key_id: 'relationship_type.synonym', en_value: 'Synonym' }),
  row({ key_id: 'relationship_type.antonym', en_value: 'Antonym' }),
  row({ key_id: 'gl.es', en_value: 'Spanish', value: 'español', source: 'import' }),
]
function locale_stat({ locale, total = 981, translated, flagged_ai = 0, flagged_en_changed = 0 }: { locale: string, total?: number, translated: number, flagged_ai?: number, flagged_en_changed?: number }) {
  return { locale, total, translated, flagged_ai, flagged_en_changed, flagged: flagged_ai + flagged_en_changed, missing: total - translated }
}

translate_store.summary = {
  locales: [
    locale_stat({ locale: 'es', translated: 930, flagged_ai: 8, flagged_en_changed: 4 }),
    locale_stat({ locale: 'fr', translated: 981 }),
    locale_stat({ locale: 'hi', translated: 420, flagged_ai: 80, flagged_en_changed: 16 }),
    locale_stat({ locale: 'sw', translated: 700, flagged_ai: 20, flagged_en_changed: 10 }),
    locale_stat({ locale: 'as', translated: 150, flagged_ai: 120, flagged_en_changed: 5 }),
    locale_stat({ locale: 'ha', translated: 300, flagged_ai: 250 }),
  ],
  translators: [
    { user_id: 'u-tina', name: 'Tina Translator', email: 'tina@example.com', locales: ['es', 'fr'] },
    { user_id: 'u-raj', name: 'Raj', email: 'raj@example.com', locales: ['hi'] },
  ],
}

function user({ admin_level = 0, translator_locales = ['es'] }: { admin_level?: number, translator_locales?: string[] } = {}) {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u-tina',
      email: 'tina@example.com',
      name: 'Tina Translator',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: admin_level >= 2,
      admin_level: admin_level as never,
      is_chat_member: admin_level >= 2,
      translator_locales,
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  return auth_user
}

const t = ((key: string) => key) as never

export const shared_meta: StoryMeta = {
  flavors: false,
}

/** A translator assigned es + fr: locale select, filter chips, mixed row states (human/missing/AI-flagged/en-changed). */
export const Translator: PageStory<typeof Component> = {
  viewports: [{ width: 1000, height: 720 }, { width: 375, height: 720 }],
  page_data: { auth_user: user({ translator_locales: ['es', 'fr'] }), t },
}

/** Admin view: progress panel with per-locale cards + Notify button above the editor. */
export const Admin: PageStory<typeof Component> = {
  viewports: [{ width: 1000, height: 760 }],
  page_data: { auth_user: user({ admin_level: 3, translator_locales: ['es', 'fr', 'hi', 'ha'] }), t },
}

/** Signed in but not assigned any language → invite-only gate. */
export const NotATranslator: PageStory<typeof Component> = {
  viewports: [{ width: 700, height: 400 }],
  page_data: { auth_user: user({ translator_locales: [] }), t },
}

/** Signed out → sign-in prompt. */
export const SignedOut: PageStory<typeof Component> = {
  viewports: [{ width: 700, height: 400 }],
  page_data: { auth_user: { user: null }, t },
}
