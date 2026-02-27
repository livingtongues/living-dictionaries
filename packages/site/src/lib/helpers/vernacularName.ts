import { page } from '$app/state'
import { glossingLanguages } from '$lib/glosses/glossing-languages'

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp]?.vernacularName)
    return glossingLanguages[bcp].vernacularName

  return `${page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}`
}
