/**
 * Bespoke per-dictionary pre-romanization converters — OUR side of the
 * white-glove alignment setup, never shown to managers. A dictionary whose
 * script has letters that don't sound like their a-z lookalikes (or isn't
 * Latin at all) gets a named converter here; `align_config.converter` selects
 * it by key and it runs on every candidate source string BEFORE
 * `ascii_distill`. Expect one-off spaghetti per language — that's fine, it
 * iterates fast here (vs the deliberately dumb, rarely-deployed Modal app).
 */
export const CONVERTERS: Record<string, (text: string) => string> = {
  // example shape (none live yet):
  // some_dictionary_slug: text => text.replaceAll('x', 'gb'),
}
