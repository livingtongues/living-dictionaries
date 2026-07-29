/**
 * The site-wide standard glossing abbreviations: the Leipzig Glossing Rules
 * appendix, the nine person+number portmanteaux every paradigm uses, and a
 * short tail of near-universal extensions.
 *
 * This is the FLOOR, not the ceiling — a dictionary's own
 * `glossing_abbreviations` rows always win on a collision (its curated wording
 * is about that language), and its bespoke codes are additive. The point of the
 * floor is that `PL` or `1SG` in a morphology field or a grammar table expands
 * for a reader even in a dictionary whose team never sat down to write a legend.
 *
 * `enName` is the fallback + the source of truth for the `gloss.*` keys in
 * `$lib/i18n/locales/en.json` (kept in lockstep by the test below), so
 * translators localise expansions like every other UI string.
 *
 * Person+number combinations are listed WHOLE (`1SG` = "first person
 * singular") rather than composed from `1` + `SG` at render time: word order
 * and agreement in the reader's language are a translator's call, not string
 * concatenation's.
 */

export interface GlossingAbbreviation {
  code: string
  enName: string
}

export const standard_glossing_abbreviations: GlossingAbbreviation[] = [
  // Person, number, and their portmanteaux
  { code: '1', enName: 'first person' },
  { code: '2', enName: 'second person' },
  { code: '3', enName: 'third person' },
  { code: 'SG', enName: 'singular' },
  { code: 'DU', enName: 'dual' },
  { code: 'PL', enName: 'plural' },
  { code: '1SG', enName: 'first person singular' },
  { code: '2SG', enName: 'second person singular' },
  { code: '3SG', enName: 'third person singular' },
  { code: '1DU', enName: 'first person dual' },
  { code: '2DU', enName: 'second person dual' },
  { code: '3DU', enName: 'third person dual' },
  { code: '1PL', enName: 'first person plural' },
  { code: '2PL', enName: 'second person plural' },
  { code: '3PL', enName: 'third person plural' },
  { code: 'INCL', enName: 'inclusive' },
  { code: 'EXCL', enName: 'exclusive' },

  // Core arguments and case
  { code: 'A', enName: 'agent-like argument of a transitive verb' },
  { code: 'P', enName: 'patient-like argument of a transitive verb' },
  { code: 'S', enName: 'single argument of an intransitive verb' },
  { code: 'SBJ', enName: 'subject' },
  { code: 'OBJ', enName: 'object' },
  { code: 'ABL', enName: 'ablative' },
  { code: 'ABS', enName: 'absolutive' },
  { code: 'ACC', enName: 'accusative' },
  { code: 'ALL', enName: 'allative' },
  { code: 'COM', enName: 'comitative' },
  { code: 'DAT', enName: 'dative' },
  { code: 'ERG', enName: 'ergative' },
  { code: 'GEN', enName: 'genitive' },
  { code: 'INS', enName: 'instrumental' },
  { code: 'INSTR', enName: 'instrumental' },
  { code: 'LOC', enName: 'locative' },
  { code: 'NOM', enName: 'nominative' },
  { code: 'OBL', enName: 'oblique' },
  { code: 'VOC', enName: 'vocative' },
  { code: 'POSS', enName: 'possessive' },

  // Tense, aspect, mood
  { code: 'FUT', enName: 'future' },
  { code: 'NPST', enName: 'non-past' },
  { code: 'PRS', enName: 'present' },
  { code: 'PST', enName: 'past' },
  { code: 'PFV', enName: 'perfective' },
  { code: 'IPFV', enName: 'imperfective' },
  { code: 'PRF', enName: 'perfect' },
  { code: 'PROG', enName: 'progressive' },
  { code: 'CONT', enName: 'continuous' },
  { code: 'DUR', enName: 'durative' },
  { code: 'HAB', enName: 'habitual' },
  { code: 'ITER', enName: 'iterative' },
  { code: 'INCH', enName: 'inchoative' },
  { code: 'COMPL', enName: 'completive' },
  { code: 'RES', enName: 'resultative' },
  { code: 'COND', enName: 'conditional' },
  { code: 'DECL', enName: 'declarative' },
  { code: 'HORT', enName: 'hortative' },
  { code: 'IMP', enName: 'imperative' },
  { code: 'IND', enName: 'indicative' },
  { code: 'IRR', enName: 'irrealis' },
  { code: 'OPT', enName: 'optative' },
  { code: 'POT', enName: 'potential' },
  { code: 'PROH', enName: 'prohibitive' },
  { code: 'PURP', enName: 'purposive' },
  { code: 'SBJV', enName: 'subjunctive' },
  { code: 'EVID', enName: 'evidential' },
  { code: 'QUOT', enName: 'quotative' },

  // Valency and voice
  { code: 'ANTIP', enName: 'antipassive' },
  { code: 'APPL', enName: 'applicative' },
  { code: 'BEN', enName: 'benefactive' },
  { code: 'CAUS', enName: 'causative' },
  { code: 'INTR', enName: 'intransitive' },
  { code: 'PASS', enName: 'passive' },
  { code: 'RECP', enName: 'reciprocal' },
  { code: 'REFL', enName: 'reflexive' },
  { code: 'TR', enName: 'transitive' },

  // Word classes, derivation, reference
  { code: 'ADJ', enName: 'adjective' },
  { code: 'ADV', enName: 'adverb(ial)' },
  { code: 'AGR', enName: 'agreement' },
  { code: 'ART', enName: 'article' },
  { code: 'AUX', enName: 'auxiliary' },
  { code: 'CLF', enName: 'classifier' },
  { code: 'COMP', enName: 'complementizer' },
  { code: 'COP', enName: 'copula' },
  { code: 'CVB', enName: 'converb' },
  { code: 'DEF', enName: 'definite' },
  { code: 'DEM', enName: 'demonstrative' },
  { code: 'DET', enName: 'determiner' },
  { code: 'DIST', enName: 'distal' },
  { code: 'DISTR', enName: 'distributive' },
  { code: 'FOC', enName: 'focus' },
  { code: 'INDF', enName: 'indefinite' },
  { code: 'INF', enName: 'infinitive' },
  { code: 'NEG', enName: 'negation, negative' },
  { code: 'NMLZ', enName: 'nominalizer / nominalization' },
  { code: 'VBZ', enName: 'verbalizer' },
  { code: 'PRED', enName: 'predicative' },
  { code: 'PROX', enName: 'proximal / proximate' },
  { code: 'PTCP', enName: 'participle' },
  { code: 'Q', enName: 'question particle / marker' },
  { code: 'REDUP', enName: 'reduplication' },
  { code: 'REL', enName: 'relative' },
  { code: 'STAT', enName: 'stative' },
  { code: 'TOP', enName: 'topic' },

  // Gender, animacy, size, emphasis
  { code: 'F', enName: 'feminine' },
  { code: 'M', enName: 'masculine' },
  { code: 'N', enName: 'neuter' },
  { code: 'ANIM', enName: 'animate' },
  { code: 'INAN', enName: 'inanimate' },
  { code: 'AUG', enName: 'augmentative' },
  { code: 'DIM', enName: 'diminutive' },
  { code: 'EMPH', enName: 'emphatic' },
  { code: 'INTS', enName: 'intensifier' },
]

const names_by_code = new Map(standard_glossing_abbreviations.map(({ code, enName }) => [code, enName]))

/** The English name of a standard code, or undefined when the code isn't standard. */
export function standard_gloss_name(code: string): string | undefined {
  return names_by_code.get(code)
}

export const standard_gloss_codes: string[] = standard_glossing_abbreviations.map(({ code }) => code)

if (import.meta.vitest) {
  describe(standard_gloss_name, () => {
    test('the catalog and the `gloss.*` English i18n keys stay in lockstep', async () => {
      const { en } = await import('$lib/i18n')
      const catalog = Object.fromEntries(standard_glossing_abbreviations.map(({ code, enName }) => [code, enName]))
      expect((en as Record<string, Record<string, string>>).gloss).toEqual(catalog)
    })

    test('every code is unique', () => {
      expect(new Set(standard_gloss_codes).size).toBe(standard_gloss_codes.length)
    })

    test('looks a code up, and says nothing about codes it does not know', () => {
      expect(standard_gloss_name('1SG')).toBe('first person singular')
      expect(standard_gloss_name('1sg')).toBe(undefined)
      expect(standard_gloss_name('PL.EMPH')).toBe(undefined)
    })
  })
}
