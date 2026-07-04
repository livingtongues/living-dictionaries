import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AuthModal.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'header.login': 'Sign in',
    'auth.send_code': 'Send code',
    'auth.enter_email': 'Enter your email',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: { t },
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {} },
}
