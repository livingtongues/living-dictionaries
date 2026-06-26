import type { Story, StoryMeta } from 'svelte-look'
import type Component from './triage-panel.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 760, height: 620 }],
}

const now = new Date().toISOString()
const noop = () => {}

export const TechnicalWithDraft: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'human',
      triage_category: 'technical',
      triage_confidence: 'high',
      triage_summary: 'Audio playback broken across entries — regression since last week.',
      triage_advice: 'Check whether the audio serving URLs resolve for this dictionary (media-url.ts → GCS/lh3). Prompt for a coding agent: "For dictionary X, query the audio rows for recent entries and verify each storage_path resolves to a 200."',
      triage_draft_reply: 'Hi there,\n\nThanks for flagging this, and sorry for the trouble! I\'m looking into why the audio isn\'t playing — could you confirm the name of the dictionary and one entry where it happens?\n\nWarmly,\nThe Living Dictionaries Team',
      triage_at: now,
    },
  },
}

export const PartnershipAdviceOnly: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'human',
      triage_category: 'partnership',
      triage_confidence: 'high',
      triage_summary: 'Nonprofit director proposing a multi-community hosting partnership + co-funding.',
      triage_advice: 'Route to Diego — partnership, reply personally (no draft). A language-revitalization nonprofit wants to host dictionaries for three Indigenous communities and raises possible co-funding. Gather which languages/communities and timeline.',
      triage_draft_reply: null,
      triage_at: now,
    },
  },
}

export const AccountWithDraft: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'human',
      triage_category: 'account',
      triage_confidence: 'high',
      triage_summary: 'Contributor requesting editor access to a specific dictionary.',
      triage_advice: 'Grant editor access on the Nuxalk dictionary for this email (or have the manager send an invite). Check whether they already have an account under this address.',
      triage_draft_reply: 'Hi there,\n\nWonderful — thank you for helping document your language! I\'ve passed your request along so you can be added as an editor on the Nuxalk dictionary.\n\nWarmly,\nThe Living Dictionaries Team',
      triage_at: now,
    },
  },
}

export const LowConfidence: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'human',
      triage_category: 'other',
      triage_confidence: 'low',
      triage_summary: 'Unclear intent — possibly press or a general inquiry.',
      triage_advice: 'Ambiguous — routed to Jacob for a human look. Category is a best guess.',
      triage_draft_reply: 'Hi there,\n\nThanks for reaching out! Could you tell me a little more about what you\'re looking for so I can point you to the right person?\n\nWarmly,\nThe Living Dictionaries Team',
      triage_at: now,
    },
  },
}

export const SpamResolved: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'spam',
      triage_category: 'other',
      triage_confidence: 'high',
      triage_summary: 'Phishing — fake overdue "invoice" for a free service.',
      triage_advice: 'Do not treat as account — Living Dictionaries is free and has no invoices. Classic phishing: fake invoice number, payment link to an unrelated domain.',
      triage_draft_reply: null,
      triage_at: now,
    },
  },
}

export const NotificationResolved: Story<typeof Component> = {
  props: {
    onusedraft: noop,
    thread: {
      triage_verdict: 'notification',
      triage_category: null,
      triage_confidence: null,
      triage_summary: 'Mail delivery / bounce notice — informational, no action needed.',
      triage_advice: null,
      triage_draft_reply: null,
      triage_at: now,
    },
  },
}
