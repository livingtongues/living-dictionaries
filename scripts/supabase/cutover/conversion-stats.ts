/**
 * Conversion bookkeeping shared by the in-process converter (richtext.ts —
 * used by the child + tests) and the isolated pool (richtext-pool.ts — used
 * by migrate.ts, which must NOT import the tiptap/happy-dom chain).
 */

export interface ConversionStats {
  converted: number
  passed_through: number
  emptied: number
  mismatches: ConversionMismatch[]
}

export interface ConversionMismatch {
  where: string
  original_html: string
  markdown: string
  original_text: string
  roundtrip_text: string
}

export function create_conversion_stats(): ConversionStats {
  return { converted: 0, passed_through: 0, emptied: 0, mismatches: [] }
}
