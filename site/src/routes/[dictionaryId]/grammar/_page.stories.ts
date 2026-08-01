import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
}

const entries_data = readable({
  tlahtoa: { id: 'tlahtoa', main: { lexeme: { default: 'tlahtoa' } }, senses: [] },
})

// The migrated blob: a headless (title-less) top-level section — the node a
// plain manager may edit the prose of. Untitled + childless, so it takes no
// section number.
const headless_intro = [
  { id: 'intro', parent_id: null, sort_key: 'i', title: null, body: { en: 'Nahuatl is a *polysynthetic* language; verbs carry subject, object, and tense affixes, so a single word can express a full clause.' }, entry_id: null, sense_id: null },
]

const section_rows = [
  { id: 's1', parent_id: null, sort_key: 'a', title: { en: 'Verb morphology' }, body: { en: 'Nahuatl is **polysynthetic**: one verb can encode subject, object, tense, and directionals.' }, entry_id: null, sense_id: null },
  { id: 's1a', parent_id: 's1', sort_key: 'a', title: { en: 'Subject prefixes' }, body: { en: 'Subjects are marked by a prefix in the first verb slot.' }, entry_id: 'tlahtoa', sense_id: null, usage_conditions: { en: 'Only on finite verbs.' }, slot_id: 'sl1' },
  { id: 's1b', parent_id: 's1', sort_key: 'b', title: { en: 'Object prefixes' }, body: { en: 'Objects occupy a second prefix slot.' }, entry_id: null, sense_id: null, slot_id: 'sl2' },
]

// Ponca's real shape in miniature (livingdictionaries.app/ponca/grammar): an
// untitled preface followed by ALLCAPS chapters, most with several subsections.
// This is the dataset the table of contents exists for.
const long_paragraph = 'The language has never had an established orthography or a generally accepted approach to writing within the community. Until relatively recent times it had always been passed down strictly by word of mouth, as part of an oral tradition where children learned the language in the home by listening to their elders throughout childhood.'

function chapter(id: string, sort_key: string, title: string) {
  return { id, parent_id: null, sort_key, title: { en: title }, body: { en: `${long_paragraph}\n\n${long_paragraph}` }, entry_id: null, sense_id: null }
}

function subsection(id: string, parent_id: string, sort_key: string, title: string) {
  return { id, parent_id, sort_key, title: { en: title }, body: { en: long_paragraph }, entry_id: null, sense_id: null }
}

const book_rows = [
  { id: 'preface', parent_id: null, sort_key: '9', title: null, body: { en: `${long_paragraph} In this section we hope to present the language in a fashion that will be intelligible to the “layman,” without drawing unnecessarily on specialized terminology.` }, entry_id: null, sense_id: null },
  chapter('pron', 'i', 'PRONUNCIATION GUIDE'),
  subsection('pron-a', 'pron', 'i', 'Vowels'),
  subsection('pron-b', 'pron', 'r', 'Stops and aspiration'),
  chapter('pos', 'r', 'PARTS OF SPEECH'),
  chapter('verb', 'w', 'THE PONCA VERB'),
  subsection('verb-a', 'verb', 'i', 'Second person Đa- ‘you’ with first person A- ‘I’'),
  subsection('verb-b', 'verb', 'r', 'Tʼą́đi ‘to run’'),
  subsection('verb-c', 'verb', 'w', 'Žáhaì ‘to stab, to prick, to stick’'),
  chapter('classes', 'y', 'VERB CLASSES'),
  chapter('paradigms', 'z', 'BASIC VERB PARADIGMS'),
  subsection('para-a', 'paradigms', 'i', 'First person plural paradigm—Đihą́ ‘to lift’'),
  subsection('para-b', 'paradigms', 'r', 'Third person plural subject paradigm'),
  chapter('tense', 'zi', 'TENSE MARKING: PAST, PRESENT, AND FUTURE'),
  chapter('articles', 'zr', 'PONCA ARTICLES AND CLASSES OF OBJECTS'),
  chapter('demonstratives', 'zw', 'DEMONSTRATIVE PRONOUNS'),
  chapter('interjections', 'zy', 'INTERJECTIONS'),
  chapter('numerals', 'zz', 'PONCA NUMERICAL SYSTEM'),
]

// Prose the way a real grammar writes it: codes in a paradigm table, codes mid
// sentence, and traps — a bare "3", an ALLCAPS word containing a code (PLUME),
// and a code glued to a vernacular form — none of which may light up.
const gloss_prose_rows = [
  {
    id: 'gp',
    parent_id: null,
    sort_key: 'a',
    title: { en: 'Person marking' },
    body: { en: 'The 1SG prefix precedes the stem, while 2SG.OBJ follows it; a 1PL.PST form therefore carries two markers. Class 3 verbs take a PLUME of suffixes, and the sequence PLđihą́ is never broken.\n\n| Person | Prefix | Gloss |\n| --- | --- | --- |\n| 1 | a- | 1SG |\n| 2 | đa- | 2SG |\n| plural | -i | PL |' },
    entry_id: null,
    sense_id: null,
  },
]

const clause_slots = [
  { id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' },
  { id: 'sl2', sort_key: 'b', name: { en: 'Object' }, code: 'OBJ' },
  { id: 'sl3', sort_key: 'c', name: { en: 'Verb stem' }, code: 'V' },
]

// q1 carries GOLD interlinear tokens — it renders as aligned form/gloss columns
// with tappable legend codes instead of a plain line. q2 has none, so the two
// example shapes sit side by side in one story.
const sentences = [
  {
    id: 'q1',
    text: { default: 'Nitlahtoa' },
    translation: { en: 'I speak.' },
    discourse_role: 'storyline',
    tokens: {
      default: [{
        form: 'Nitlahtoa',
        start: 0,
        end: 9,
        morphemes: [
          { form: 'Ni', gloss: { default: '1SG' } },
          { form: 'tlahtoa', gloss: { en: 'speak' }, entry_id: 'tlahtoa', separator: '-' },
        ],
      }],
    },
  },
  { id: 'q2', text: { default: 'Ti-tlahtoa' }, translation: { en: 'You speak.' } },
]

const glossing_abbreviations = [
  { id: 'g1', code: '1SG', name: { en: 'first person singular' }, category: 'person' },
  { id: 'g2', code: '2SG', name: { en: 'second person singular' }, category: 'person' },
  { id: 'g3', code: 'PL', name: { en: 'plural' }, category: 'number' },
]

const section_sentences = [
  { id: 'ss1', section_id: 's1a', sentence_id: 'q1', sort_key: 'a' },
  { id: 'ss2', section_id: 's1a', sentence_id: 'q2', sort_key: 'b' },
]

function page_data({ rows, admin_level = 0, slots = clause_slots }: { rows: { id: string }[], admin_level?: number, slots?: { id: string }[] }) {
  return {
    t: mock_t,
    dictionary,
    entries_data,
    auth_user: { admin_level },
    writes: {},
    dict_db: mock_dict_db({ grammar_sections: rows, clause_slots: slots, sentences, section_sentences, glossing_abbreviations: rows.length ? glossing_abbreviations : [] }),
  } as never
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 820, height: 940 }],
  page_data: { t: mock_t, auth_user: { admin_level: 0 } } as never,
}

// Public viewer (post-cutover): the section tree renders read-only for everyone.
export const Viewer: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows }),
  props: { dictionary, is_manager: false } as never,
}

// Public viewer on a dict with no grammar yet — "no info yet".
export const ViewerEmpty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [] }),
  props: { dictionary, is_manager: false } as never,
}

// Manager (non-admin-3) on the migrated headless intro. An untitled, childless
// section takes no number — it reads as a preface, not "section 1".
export const ManagerProse: PageStory<typeof Component> = {
  page_data: page_data({ rows: headless_intro }),
  props: { dictionary, is_manager: true } as never,
}

// A manager on the full tree — READ mode is what loads, so the only editing
// affordance is the "Edit" button in the header row.
export const ManagerSections: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows }),
  props: { dictionary, is_manager: true } as never,
}

// The same manager after tapping "Edit" — the full workbench: per-section
// controls, add buttons, and the clause-slot editor.
export const ManagerEditing: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows }),
  props: { dictionary, is_manager: true } as never,
  csr: true,
  interactions: async (page) => {
    await page.click('.header-row button')
    await page.waitForSelector('.slot-controls')
  },
}

// Manager on a dict with no grammar at all — the "Add grammar" affordance
// (behind Edit, since read mode shows the visitor's view).
export const ManagerEmpty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [] }),
  props: { dictionary, is_manager: true } as never,
}

// ── Table of contents ──────────────────────────────────────────────────────
// A Ponca-scale grammar. Desktop gets the sticky right rail with scroll-spy.
export const BookDesktop: PageStory<typeof Component> = {
  viewports: [{ width: 1280, height: 900 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
}

// Scrolled deep into chapter 3 — the active chapter expands to its subsections.
export const BookDesktopScrolled: PageStory<typeof Component> = {
  viewports: [{ width: 1280, height: 900 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: true } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.rail')
    await page.evaluate(() => document.getElementById('section-verb-b')?.scrollIntoView())
    await new Promise(resolve => setTimeout(resolve, 400))
  },
}

// The foot of the book: the clause-template strip and the glossing legend sit
// together as reference apparatus, and the TOC pins both below the chapters.
export const BookDesktopReference: PageStory<typeof Component> = {
  viewports: [{ width: 1280, height: 900 }],
  page_data: page_data({ rows: book_rows }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.rail')
    await page.evaluate(() => document.getElementById('grammar-clause-template')?.scrollIntoView())
    await new Promise(resolve => setTimeout(resolve, 400))
  },
}

// The collapsed "standard abbreviations used here" roll, expanded: the standard
// Leipzig codes the page's prose actually uses that the curated table above
// doesn't already cover (1PL, OBJ, PST — from the prose composites).
export const LegendStandardExpanded: PageStory<typeof Component> = {
  viewports: [{ width: 820, height: 700 }],
  page_data: page_data({ rows: gloss_prose_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.legend .standard summary')
    await page.evaluate(() => document.querySelector('.legend')?.scrollIntoView())
    await page.click('.legend .standard summary')
    await new Promise(resolve => setTimeout(resolve, 200))
  },
}

// Scrolled deep, then the rail heading is clicked: it is a "back to top"
// target, so the page returns to the preface (and drops the section hash).
export const BookDesktopBackToTop: PageStory<typeof Component> = {
  viewports: [{ width: 1280, height: 900 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.rail')
    await page.evaluate(() => document.getElementById('section-tense')?.scrollIntoView())
    await new Promise(resolve => setTimeout(resolve, 300))
    await page.click('.rail-heading')
    await new Promise(resolve => setTimeout(resolve, 900))
  },
}

// ── Glossing codes in the prose ────────────────────────────────────────────
// Curated (1SG, 2SG, PL) and standard-catalog (2SG.OBJ, 1PL.PST) codes alike go
// small-caps and tappable; "3", "PLUME" and "PLđihą́" stay plain text.
export const ProseGlossCodes: PageStory<typeof Component> = {
  viewports: [{ width: 820, height: 560 }],
  page_data: page_data({ rows: gloss_prose_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.gloss-code')
  },
}

// Tapping a composed code shows the expansion assembled from its parts.
export const ProseGlossCodeExpanded: PageStory<typeof Component> = {
  viewports: [{ width: 820, height: 560 }],
  page_data: page_data({ rows: gloss_prose_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('[data-gloss-code="1PL.PST"]')
    await page.click('[data-gloss-code="1PL.PST"]')
    await page.waitForSelector('[role="dialog"]')
  },
}

// Narrow viewport at the top of the page: the bar offers the "Contents" (the
// heading right above it already says Grammar).
export const BookMobileIdle: PageStory<typeof Component> = {
  viewports: [{ width: 480, height: 400 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.toc-bar')
  },
}

// Narrow viewport: the sticky "you are here" bar, closed.
export const BookMobile: PageStory<typeof Component> = {
  viewports: [{ width: 480, height: 780 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.toc-bar')
    await page.evaluate(() => document.getElementById('section-verb-b')?.scrollIntoView())
    await new Promise(resolve => setTimeout(resolve, 400))
  },
}

// …and opened, dropping the full contents over the page.
export const BookMobileTocOpen: PageStory<typeof Component> = {
  viewports: [{ width: 480, height: 780 }],
  page_data: page_data({ rows: book_rows, slots: [] }),
  props: { dictionary, is_manager: false } as never,
  csr: true,
  interactions: async (page) => {
    await page.waitForSelector('.toc-bar')
    await page.evaluate(() => document.getElementById('section-verb-b')?.scrollIntoView())
    await new Promise(resolve => setTimeout(resolve, 300))
    await page.click('.bar-button')
    await new Promise(resolve => setTimeout(resolve, 400))
  },
}

// Admin-3: the same read-first page; edit mode unlocks the structural controls.
export const Admin3Sections: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows, admin_level: 3 }),
  props: { dictionary, is_manager: true } as never,
}

// Admin-3 on a dict with no sections yet.
export const Admin3Empty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [], admin_level: 3 }),
  props: { dictionary, is_manager: true } as never,
}
