import { glossing_languages } from '$lib/glosses/glossing-languages'
import { page } from '$app/state'

export function vernacularName(bcp: string) {
  if (glossing_languages[bcp]?.vernacularName)
    return glossing_languages[bcp].vernacularName

  const { data: { t } } = page
  return `${t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}`
}
