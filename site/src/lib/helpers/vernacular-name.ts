import { glossingLanguages } from '$lib/glosses/glossing-languages'
import { page } from '$app/state'

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp]?.vernacularName)
    return glossingLanguages[bcp].vernacularName

  const { data: { t } } = page
  return `${t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}`
}
