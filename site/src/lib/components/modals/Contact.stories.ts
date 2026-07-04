import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Contact.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'header.tutorials': 'Tutorials',
    'header.contact_us': 'Contact Us',
    'contact.select_topic': 'Select a topic',
    'contact.what_is_your_question': 'What is your question?',
    'contact.enter_message': 'Enter message',
    'contact.your_email_address': 'Your email address',
    'contact.email': 'Email',
    'contact.send_message': 'Send message',
    'contact.delete_dictionary': 'Delete dictionary',
    'contact.public_dictionary': 'Make dictionary public',
    'contact.import_data': 'Import data',
    'contact.request_access': 'Request access',
    'contact.learning': 'Learning materials',
    'contact.report_problem': 'Report a problem',
    'contact.other': 'Other',
    'misc.cancel': 'Cancel',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: {
    t,
    dictionary: undefined,
    auth_user: { user: null, is_admin: false },
    about_is_too_short: () => false,
  },
}

export const LoggedOut: Story<typeof Component> = {
  props: { on_close: () => {} },
}

export const LoggedIn: Story<typeof Component> = {
  page_data: {
    t,
    dictionary: undefined,
    auth_user: { user: { id: 'u1', name: 'Jane', email: 'jane@example.com' }, is_admin: false },
    about_is_too_short: () => false,
  },
  props: { on_close: () => {} },
}
