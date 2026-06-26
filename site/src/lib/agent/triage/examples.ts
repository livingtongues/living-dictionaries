import type { TriageResult } from './types'

/**
 * Handwritten, curated few-shot exemplars for Living Dictionaries — NOT
 * auto-pulled from past threads. Each shows: what the writer says → how we
 * handle it (the action to take) → the draft we'd send, written as if that
 * action is done.
 *
 * Tuning notes baked into these:
 *  - technical drafts are short + reassuring; advice carries a ready prompt for
 *    a coding agent (which table/log to check for the given dict/user).
 *  - content drafts give concrete editor steps or "we'll fix it"; advice names
 *    the specific dictionary + field.
 *  - account drafts confirm access was passed/granted; advice states the exact
 *    dictionary + role + whether the requester has an account yet.
 *  - partnership gets NO customer draft (an admin replies personally); advice
 *    gives who/what/which-language context.
 *  - Living Dictionaries is FREE, so any "invoice/charge" mail is phishing →
 *    spam, never account.
 *
 * Keep these few and high-quality; bad examples poison every future draft.
 */
export interface TriageExample {
  /** A representative inbound message (trimmed). */
  inbound: string
  /** The ideal triage output for it. */
  output: TriageResult
}

export const TRIAGE_EXAMPLES: readonly TriageExample[] = [
  {
    inbound: 'The audio recordings won\'t play on any of my entries — I just see the play button but nothing happens when I click it. It worked last week. Using Chrome on Windows.',
    output: {
      verdict: 'human',
      category: 'technical',
      confidence: 'high',
      summary: 'Audio playback broken across entries — regression since last week.',
      advice: 'Check whether the audio serving URLs resolve for this dictionary (media-url.ts → GCS/lh3) and whether recent uploads stored a valid storage_path. Prompt for a coding agent: "For dictionary X, query the audio rows for the most recent entries and verify each storage_path resolves to a 200 from the serving URL; report any 404s or null paths." Confirm it isn\'t a browser autoplay/codec issue.',
      draft_reply: 'Hi there,\n\nThanks for flagging this, and sorry for the trouble! I\'m looking into why the audio isn\'t playing — could you confirm the name of the dictionary and one entry where it happens, so I can check it directly? I\'ll get this sorted out.\n\nWarmly,\nThe Living Dictionaries Team',
      spam_reason: null,
    },
  },
  {
    inbound: 'How do I add a second meaning to a word? Some of our words have several senses and I only see one definition box.',
    output: {
      verdict: 'human',
      category: 'content',
      confidence: 'high',
      summary: 'How-to: adding multiple senses/glosses to a single entry.',
      advice: 'Standard editor question — multiple senses per entry. Point them to the "add a sense" control on the entry page. If their dictionary predates multi-sense, confirm the entry model supports it. Low urgency; no data fix needed.',
      draft_reply: 'Hi there,\n\nGreat question! An entry can hold several senses. Open the word in the editor and look for the option to add another sense — each sense gets its own gloss/definition, part of speech, and example sentences, so you can capture every meaning of the word separately.\n\nLet me know if you don\'t see that option and I\'ll take a closer look.\n\nWarmly,\nThe Living Dictionaries Team',
      spam_reason: null,
    },
  },
  {
    inbound: 'I\'m a community member helping document our language and the dictionary manager asked me to start adding words. Could you give me editor access to the Nuxalk dictionary? My email is this one.',
    output: {
      verdict: 'human',
      category: 'account',
      confidence: 'high',
      summary: 'Contributor requesting editor access to a specific dictionary.',
      advice: 'Grant editor access on the Nuxalk dictionary for this email (or have the manager send an invite from the contributors page). Check whether they already have a Living Dictionaries account under this address; if not, an invite will prompt them to create one. Confirm with the manager if you\'re unsure they authorized it.',
      draft_reply: 'Hi there,\n\nWonderful — thank you for helping document your language! I\'ve passed your request along so you can be added as an editor on the Nuxalk dictionary. You\'ll get access shortly; if you don\'t already have an account, you\'ll be prompted to create one with this email address.\n\nWarmly,\nThe Living Dictionaries Team',
      spam_reason: null,
    },
  },
  {
    inbound: 'Hello, I direct a language revitalization nonprofit and we\'d love to explore partnering with Living Tongues to host dictionaries for three Indigenous communities we work with. Who can we talk to about collaboration and possible co-funding?',
    output: {
      verdict: 'human',
      category: 'partnership',
      confidence: 'high',
      summary: 'Nonprofit director proposing a multi-community hosting partnership + co-funding.',
      advice: 'Route to Diego — partnership, reply personally (no draft). Context: a language-revitalization nonprofit wants to host dictionaries for three Indigenous communities and raises possible co-funding. Worth a real conversation; gather which languages/communities and their timeline. Diego/Greg will want to weigh in on data stewardship + community consent.',
      draft_reply: null,
      spam_reason: null,
    },
  },
  {
    inbound: 'I tried to log in to add words but the sign-in email never arrives. I\'ve checked my spam folder. Gmail address.',
    output: {
      verdict: 'human',
      category: 'account',
      confidence: 'high',
      summary: 'Sign-in OTP email not being received.',
      advice: 'Check whether an email_codes row was generated for this address and whether SES shows a send/bounce. Common causes: typo\'d address, SES suppression list, or Gmail filtering. Prompt for a coding agent: "Given email X, query email_codes for recent OTP rows and check SES send logs / suppression list; report whether the code was generated and whether SES accepted or bounced it." Could also offer Google sign-in as a workaround.',
      draft_reply: 'Hi there,\n\nSorry for the hassle logging in! I\'m checking why the sign-in email isn\'t reaching you. Could you confirm the exact email address you\'re using? In the meantime, if you have a Google account on that address, the "Sign in with Google" option is a quick way in.\n\nWarmly,\nThe Living Dictionaries Team',
      spam_reason: null,
    },
  },
  {
    inbound: 'FINAL NOTICE: Your Living Dictionaries invoice #44192 of $89.00 is overdue. Pay immediately at the link below to avoid suspension of your account: http://ld-billing-secure.example/pay',
    output: {
      verdict: 'spam',
      category: 'other',
      confidence: 'high',
      summary: 'Phishing — fake overdue "invoice" for a free service.',
      advice: 'Do not treat as account/billing — Living Dictionaries is free and has no invoices. Classic phishing: fake invoice number, payment link to an unrelated domain, suspension threat. Resolve as spam.',
      draft_reply: null,
      spam_reason: 'Fake $89 "invoice" with a payment link to an unrelated domain; Living Dictionaries is free and never bills — phishing.',
    },
  },
]
