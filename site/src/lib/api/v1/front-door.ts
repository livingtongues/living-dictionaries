/**
 * The `/api/v1` FRONT DOOR — the small doc an agent reads first.
 *
 * Deliberately tiny (a few KB) and task-routing rather than comprehensive: an
 * agent arrives knowing what its human wants, not which endpoint to call, so
 * this hands it a menu of JOBS, each pointing at the guide to read and the next
 * call to make. The reference (`openapi.json`) is listed LAST on purpose — it is
 * ~200KB and reading it before the task guide is how agents end up importing
 * badly. Guides are the primary layer; the spec is the appendix.
 *
 * ONE object serves three consumers, so they cannot drift:
 *   • agents → JSON (`front-door` route, content-negotiated)
 *   • humans in a browser → HTML (`front-door-html.ts`)
 *   • the admin docs route tree → fetches the JSON and renders the same menu
 */

import { OPENAPI_TAGS } from './openapi'

export interface FrontDoorNextCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** OpenAPI-style path (`{id}` placeholder) — substituted when a key identifies the dictionary. */
  path: string
  why: string
}

export interface FrontDoorTask {
  id: string
  title: string
  /** The "is this you?" line an agent matches its human's request against. */
  when: string
  /** Guide slugs in reading order — the FIRST is the one to read now. */
  guides: string[]
  next: FrontDoorNextCall[]
}

/**
 * The six jobs. Order matters — `import` is the common case and is listed first.
 * Every `guides` slug must exist in `guides/index.ts` and every `next.path` must
 * exist in the OpenAPI spec; both are test-enforced (`front-door.test.ts`).
 */
export const FRONT_DOOR_TASKS: FrontDoorTask[] = [
  {
    id: 'import',
    title: 'Import material into a dictionary',
    when: 'Your human has source material — a spreadsheet, a FLEx/LIFT/Toolbox export, a scanned PDF dictionary, a word list, field notes — that should become entries. THE MOST COMMON JOB. Do not start writing entries until you have read the importing guide; it front-loads a whole data-preparation phase (inspect, question the human, stage locally, review by eye, get sign-off) that happens BEFORE your first write.',
    guides: ['importing', 'spreadsheets', 'flex-lift', 'pdf-scans', 'api-basics'],
    next: [
      { method: 'GET', path: '/api/v1/guides/importing', why: 'The mandatory runbook. Read it fully before anything else.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}/files', why: 'The resources the dictionary team uploaded for you, each with its authoritative per-file import_instructions.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}', why: 'The dictionary\'s gloss_languages + orthographies — the locale codes your glosses must be keyed by.' },
    ],
  },
  {
    id: 'cleanup',
    title: 'Audit, correct, or normalize an existing dictionary',
    when: 'The dictionary already has entries and your human wants them fixed, deduplicated, normalized, filled in, or reviewed — including undoing a bad earlier import.',
    guides: ['cleanup', 'api-basics'],
    next: [
      { method: 'GET', path: '/api/v1/guides/cleanup', why: 'Auditing recipes, the surgical single-row fixes, the review queue, and how to undo a bad import.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}/entries', why: 'Page through the current data (add ?include=senses) before you change anything.' },
    ],
  },
  {
    id: 'consume',
    title: 'Read the dictionary for an app, study tool, or analysis',
    when: 'You are building or feeding something that READS this dictionary — a language-learning app, a flashcard deck, a corpus analysis, a mirror — and never needs to write.',
    guides: ['consume'],
    next: [
      { method: 'GET', path: '/api/v1/guides/consume', why: 'Do NOT paginate the API for bulk reads — download the whole dictionary as one gzipped SQLite snapshot and query it locally.' },
    ],
  },
  {
    id: 'media',
    title: 'Attach or fix audio, photos, and video',
    when: 'Your human has recordings, images, or video to attach — or wants speaker attribution fixed, or karaoke word-timings generated for sentence/text audio.',
    guides: ['media', 'api-basics'],
    next: [
      { method: 'GET', path: '/api/v1/guides/media', why: 'Upload shapes, the attribution rule (audio/video REQUIRE a speaker or a source), size caps, and karaoke timings.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}/speakers', why: 'The speakers already on file — reuse one rather than inventing a placeholder.' },
    ],
  },
  {
    id: 'corpus',
    title: 'Work with texts, interlinear glossing, or the grammar',
    when: 'Your human is documenting connected material rather than isolated words — stories/passages with ordered sentences, interlinear glossed text (IGT), or the dictionary\'s structured grammar description.',
    guides: ['corpus', 'api-basics'],
    next: [
      { method: 'GET', path: '/api/v1/guides/corpus', why: 'Texts vs. example sentences, the token/gloss alignment shape, and the grammar-section tree.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}/texts', why: 'The texts already in this dictionary.' },
    ],
  },
  {
    id: 'ask-us',
    title: 'Ask the Living Dictionaries team',
    when: 'You hit a wall: a field that does not exist, a bug, an awkward shape, or a decision only a human can make. Ask us rather than inventing a workaround — this genuinely shapes what we build next.',
    guides: [],
    next: [
      { method: 'POST', path: '/api/v1/dictionaries/{id}/feedback', why: 'Send `{ message }` straight to the team (works with read OR write keys). Relay the response\'s note back to your human.' },
      { method: 'GET', path: '/api/v1/dictionaries/{id}/conversations', why: 'If you are working an import request, its conversation is where you post messages, questions, and the final report.' },
    ],
  },
]

export interface FrontDoorContext {
  dictionary: {
    id: string
    url: string | null
    name: string
    gloss_languages: string[] | null
    entry_count: number
  }
  scope: 'read' | 'write'
  open_import_conversations: number
  /** Uploaded resources not yet linked to a source — i.e. import work not begun. */
  unlinked_files: number
}

export interface SuggestedTask {
  task: string
  because: string
}

/**
 * Which job this key's dictionary most likely needs right now. Ordered by how
 * strong the signal is: an explicitly-requested import beats a guess from
 * emptiness, and a read-only key settles it outright.
 */
export function suggest_task(context: FrontDoorContext): SuggestedTask {
  const { scope, open_import_conversations, unlinked_files, dictionary } = context
  if (scope === 'read')
    return { task: 'consume', because: 'Your key is read-only, so you cannot write — read in bulk from the snapshot.' }
  if (open_import_conversations > 0)
    return { task: 'import', because: `This dictionary has ${open_import_conversations} open import conversation${open_import_conversations === 1 ? '' : 's'} — that is the work waiting for you.` }
  if (unlinked_files > 0)
    return { task: 'import', because: `${unlinked_files} uploaded resource${unlinked_files === 1 ? ' is' : 's are'} not yet linked to a source, so their import has not been done.` }
  if (dictionary.entry_count === 0)
    return { task: 'import', because: 'This dictionary has no entries yet.' }
  return { task: 'cleanup', because: `This dictionary already holds ${dictionary.entry_count} entries and has no import waiting, so most work here is correcting or extending them.` }
}

export interface FrontDoorDoc {
  name: string
  what: string
  start: string
  auth: { header: string, key: string, scopes: string }
  tasks: (Omit<FrontDoorTask, 'guides' | 'next'> & {
    guides: { slug: string, url: string }[]
    next: { method: string, url: string, why: string }[]
  })[]
  guides_index: string
  reference: {
    note: string
    index: string
    by_group: string
    full: string
    groups: string[]
  }
  dictionary?: FrontDoorContext['dictionary'] & { scope: 'read' | 'write' }
  suggested_task?: SuggestedTask
}

/**
 * Build the doc. With no `context` it is anonymous + cacheable; with one (a
 * valid API key was presented) it names the dictionary, substitutes its real id
 * into every path, and recommends a task.
 */
export function build_front_door({ origin, context }: { origin: string, context?: FrontDoorContext }): FrontDoorDoc {
  const dictionary_id = context?.dictionary.url ?? context?.dictionary.id ?? '{id}'
  const url_of = (path: string) => `${origin}${path.replace('{id}', dictionary_id)}`

  return {
    name: 'Living Dictionaries Write API (v1)',
    what: 'Programmatic read/write access to ONE Living Dictionary — a language community\'s record of its words, sentences, texts, and recordings. An agent can do anything a human editor can.',
    start: 'You are at the front door. Find your job in `tasks` below, read its FIRST guide before you do anything else, then use the endpoint reference. Reading the reference first is the wrong order — the guides carry the judgement calls (what to ask your human, what not to guess, how not to corrupt a language\'s data), and the reference only carries field shapes.',
    auth: {
      header: 'Authorization: Bearer ldk_…',
      key: 'Your human mints the key on their dictionary\'s Agents page and gives it to you along with the dictionary id (the `<id>` in its web URL). A key works on exactly one dictionary.',
      scopes: 'A key is read-only or read & write. Present it here and this page will name your dictionary and suggest where to start.',
    },
    tasks: FRONT_DOOR_TASKS.map(({ guides, next, ...task }) => ({
      ...task,
      guides: guides.map(slug => ({ slug, url: `${origin}/api/v1/guides/${slug}` })),
      next: next.map(call => ({ method: call.method, url: url_of(call.path), why: call.why })),
    })),
    guides_index: `${origin}/api/v1/guides`,
    reference: {
      note: 'Read your task\'s guide FIRST. Then fetch only the group you need — the full spec is ~200KB and you almost never want all of it.',
      index: `${origin}/api/v1/openapi.json`,
      by_group: `${origin}/api/v1/openapi.json?tag=entries`,
      full: `${origin}/api/v1/openapi.json?view=full`,
      groups: OPENAPI_TAGS.map(tag => tag.name),
    },
    ...(context && {
      dictionary: { ...context.dictionary, scope: context.scope },
      suggested_task: suggest_task(context),
    }),
  }
}
