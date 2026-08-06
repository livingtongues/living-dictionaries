import { glossing_languages } from '$lib/gloss/glossing-languages'
import { page } from '$app/state'

export function vernacular_name(bcp: string) {
  if (glossing_languages[bcp]?.vernacularName)
    return glossing_languages[bcp].vernacularName

  const { data: { t } } = page
  return `${t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}`
}
