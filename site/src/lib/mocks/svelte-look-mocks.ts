import type { MockedContext } from 'svelte-look'

// Default i18n mock: returns the fallback (or the key itself) so stories render readable text
// without wiring the real i18n catalog. Override `t` in a story's page_data for nicer labels.
function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  return key
}

export const default_page_data: Record<string, any> = {
  t,
  locale: 'en',
  auth_user: { user: null, is_admin: false },
}

export const default_contexts: MockedContext[] = []
