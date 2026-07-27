/**
 * Task playbooks for agents (and humans): lean markdown docs served at
 * `/api/v1/guides` (list) + `/api/v1/guides/{slug}` (raw markdown).
 *
 * These are the PRIMARY documentation layer — the front door (`GET /api/v1`)
 * routes an agent to the guide for its job, and the OpenAPI spec is the appendix
 * it reads afterwards for field shapes. Guides carry the judgement calls (what to
 * ask the human, what never to guess, how not to corrupt a language's data); the
 * spec carries only schemas. Grow guide-by-guide as real jobs teach us things;
 * keep each one tight.
 */

const raw_guides = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface GuideInfo {
  slug: string
  title: string
  description: string
}

/**
 * Hand-curated blurbs, in recommended reading order. `api-basics` first (the
 * mechanics every job shares), then the import runbook + its format guides, then
 * the remaining task playbooks. The front door's `FRONT_DOOR_TASKS` reference
 * these slugs — a test enforces that every referenced slug exists.
 */
const GUIDE_DESCRIPTIONS: Record<string, string> = {
  'api-basics': 'READ ONCE, applies to every job: auth, the dictionary id, multilingual fields (and never stripping diacritics), the data model, generating your own ids for idempotency, batch results + errors, size limits, and how to fetch the reference in slices.',
  'importing': 'START HERE for any import job — the ordered runbook. Phase 0 set up (download the resources, register the source, file the resources under it); phase 1 data preparation (inspect, ask the human the linguistic questions inspection raises, stage locally as JSONL/SQLite, review the data by eye in bulk, clean, preview sign-off); phase 2 API usage (batching, idempotency, the human review queue, verification, repair/re-sync, rollback, reporting).',
  'spreadsheets': 'CSV/Excel/Google Sheets: column-mapping heuristics, multi-sense and multi-value cells, encoding traps.',
  'flex-lift': 'FLEx, LIFT, and Toolbox/Shoebox SFM-MDF: which export to prefer and the backslash-marker → API field map.',
  'pdf-scans': 'Scanned printed dictionaries: why NOT to use OCR (read every page with vision instead, zooming in on uncertain diacritics), front-matter legend, page-range workflow, diacritic fidelity, per-page citations.',
  'cleanup': 'Auditing and correcting a dictionary that already has entries: bulk-reading and eyeballing it, common audits, queueing judgement calls on the editor-only review flag instead of guessing, the surgical single-row fixes, PATCH merge semantics (it never deletes), and undoing a bad import via batch-delete.',
  'consume': 'Reading a dictionary for an app, analysis, or mirror: download the gzipped SQLite snapshot instead of paginating, open it read-only, query the key tables, fetch media bytes — plus when the API is the better choice.',
  'media': 'Audio, photos, and video: the one-call upload+link routes, the attribution rule (audio/video REQUIRE a real speaker or a source — never invent a placeholder person), idempotency and replace, size caps, and karaoke word-timings via forced alignment.',
  'corpus': 'Connected texts, interlinear glossed text (IGT), and the structured grammar: texts vs. example sentences, the token list as the shared 1:1 alignment index, the locked gloss convention, the grammar-section tree, and the word→entry matching queue.',
}

function slug_of(path: string): string {
  return path.replace('./', '').replace('.md', '')
}

export function list_guides(): GuideInfo[] {
  const slugs = Object.keys(raw_guides).map(slug_of).filter(slug => slug in GUIDE_DESCRIPTIONS)
  const ordered = Object.keys(GUIDE_DESCRIPTIONS).filter(slug => slugs.includes(slug))
  return ordered.map(slug => ({
    slug,
    title: get_guide(slug)?.match(/^# (.+)$/m)?.[1] ?? slug,
    description: GUIDE_DESCRIPTIONS[slug],
  }))
}

export function get_guide(slug: string): string | null {
  return raw_guides[`./${slug}.md`] ?? null
}

if (import.meta.vitest) {
  describe(list_guides, () => {
    test('every guide has a manifest description and an h1 title', () => {
      const guides = list_guides()
      expect(guides.map(guide => guide.slug)).toEqual(['api-basics', 'importing', 'spreadsheets', 'flex-lift', 'pdf-scans', 'cleanup', 'consume', 'media', 'corpus'])
      for (const guide of guides)
        expect(guide.title.length).toBeGreaterThan(4) // eslint-disable-line no-restricted-syntax -- genuine range check
    })

    test('every .md on disk is listed (a new guide must get a description)', () => {
      expect(Object.keys(raw_guides)).toHaveLength(list_guides().length)
    })
  })

  describe(get_guide, () => {
    test('returns raw markdown for a known slug, null otherwise', () => {
      expect(get_guide('importing')).toContain('# Importing a dictionary')
      expect(get_guide('nope')).toBe(null)
    })
  })
}
