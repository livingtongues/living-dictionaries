import type { TranslateFunction } from '$lib/i18n/types'
import type { GlossPiece, LegendEntry } from './gloss-legend'
import { standard_gloss_codes, standard_gloss_name } from '$lib/mappings/glossing-abbreviations'
import { build_gloss_splitter, build_token_gloss_splitter, legend_expansion } from './gloss-legend'

/**
 * One dictionary's working set of glossing codes: its own curated
 * `glossing_abbreviations` rows layered over the site-wide standard Leipzig
 * catalog. The dictionary always wins on a collision — its wording is about
 * that language — and the standard set fills in everything a team never got
 * around to registering, so `1SG` or `PL` expands on tap in EVERY dictionary.
 *
 * Three splitters, because the same code is differently trustworthy depending
 * on where it sits:
 * - `split_gloss_cell` — interlinear gloss lines. Curated codes match anywhere
 *   (the promise the schema makes); standard codes need token boundaries, but
 *   even a bare `A` / `S` / `P` counts, since a gloss cell is analysis by
 *   definition.
 * - `split_field` — free-text fields such as entry `morphology`. Same, minus
 *   the ambiguous standard codes: dictionaries write real sentences in these
 *   fields, and "A" is an English word before it is a Leipzig code.
 * - `split_prose` — authored prose (grammar sections). Token boundaries for
 *   EVERYTHING including curated codes, and ambiguous codes dropped: a legend
 *   row for `3` must not small-caps every "3" in a page of running text.
 */

export interface GlossCatalog {
  /** Expansion for the reader, including dot-composites; '' when unknown. */
  expand: (code: string) => string
  /** True when this code has an expansion to show. */
  has: (code: string) => boolean
  split_gloss_cell: (text: string) => GlossPiece[]
  split_field: (text: string) => GlossPiece[]
  split_prose: (text: string) => GlossPiece[]
  /**
   * The STANDARD codes (not curated by the dictionary — those have their own
   * legend table) present in the given content, sorted. Dot-composites count
   * per part. Feeds the collapsed "standard abbreviations" page-foot section.
   */
  standard_codes_used: (content: { gloss_cells?: readonly string[], prose?: readonly string[] }) => string[]
}

/** How the parts of a dot-composite are strung together for the reader. */
const COMPOSITE_SEPARATOR = ' · '

/**
 * A code that reads as ordinary content when it stands alone in prose: a single
 * character (`3`, `A`, `M`), or one with no upper-case letter at all (a
 * lower-case curated code is indistinguishable from a word).
 */
function is_ambiguous_in_prose(code: string): boolean {
  return [...code].length < 2 || !/\p{Lu}/u.test(code)
}

export function build_gloss_catalog({ legend, language, t }: {
  legend: readonly LegendEntry[]
  /** Reader's gloss language, for the dictionary's own expansions. */
  language: string | null | undefined
  t: TranslateFunction
}): GlossCatalog {
  const dictionary_by_code = new Map(legend.filter(entry => entry?.code).map(entry => [entry.code, entry]))
  const dictionary_codes = [...dictionary_by_code.keys()]

  function standard_expansion(code: string): string {
    const standard = standard_gloss_name(code)
    // Only ever look up codes the standard catalog actually owns — a bespoke
    // code is dictionary data, not a missing UI string to report.
    return standard ? t({ dynamicKey: `gloss.${code}`, fallback: standard }) : ''
  }

  /**
   * True when a curated row merely restates the standard wording — it adds
   * nothing about this language, so the localized standard expansion should win.
   * (Curated rows exist for what the standard set CAN'T cover.)
   */
  function is_restatement(code: string, wording: string): boolean {
    const standard = standard_gloss_name(code)
    return !!standard && wording.trim().toLowerCase() === standard.toLowerCase()
  }

  function expansion_of(code: string): string {
    const curated = dictionary_by_code.get(code)
    if (curated) {
      const wording = legend_expansion({ entry: curated, language })
      if (!is_restatement(code, wording))
        return wording
    }
    return standard_expansion(code)
  }

  function expand(code: string): string {
    const direct = expansion_of(code)
    if (direct)
      return direct
    const parts = code.split('.')
    if (parts.length < 2)
      return ''
    const expansions = parts.map(expansion_of)
    return expansions.every(Boolean) ? expansions.join(COMPOSITE_SEPARATOR) : ''
  }

  const standard_only = standard_gloss_codes.filter(code => !dictionary_by_code.has(code))
  const prose_codes = [...dictionary_codes, ...standard_only].filter(code => !is_ambiguous_in_prose(code))

  const split_curated = build_gloss_splitter(dictionary_codes)
  const split_standard = build_token_gloss_splitter({ codes: standard_only })
  const split_standard_unambiguous = build_token_gloss_splitter({ codes: standard_only.filter(code => !is_ambiguous_in_prose(code)) })
  const split_all_prose = build_token_gloss_splitter({ codes: prose_codes })

  /** Curated codes first, then the standard set over whatever text is left. */
  function layered(split_rest: (text: string) => GlossPiece[]) {
    return (text: string): GlossPiece[] =>
      split_curated(text).flatMap(piece => (piece.code ? [piece] : split_rest(piece.text)))
  }

  const split_gloss_cell = layered(split_standard)

  function standard_codes_used({ gloss_cells = [], prose = [] }: { gloss_cells?: readonly string[], prose?: readonly string[] }): string[] {
    const used = new Set<string>()
    function collect(pieces: GlossPiece[]) {
      for (const piece of pieces) {
        if (!piece.code)
          continue
        for (const part of piece.code.split('.')) {
          // Any curated code belongs to the curated table above, not here —
          // even a restatement row (which that table renders localized anyway).
          if (standard_gloss_name(part) && !dictionary_by_code.has(part))
            used.add(part)
        }
      }
    }
    for (const cell of gloss_cells) collect(split_gloss_cell(cell))
    for (const text of prose) collect(split_all_prose(text))
    return [...used].sort()
  }

  return {
    expand,
    has: (code: string) => !!expand(code),
    split_gloss_cell,
    split_field: layered(split_standard_unambiguous),
    split_prose: split_all_prose,
    standard_codes_used,
  }
}
