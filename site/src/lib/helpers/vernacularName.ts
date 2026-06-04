import { get } from 'svelte/store'
import { glossingLanguages } from '$lib/glosses/glossing-languages'
import { page } from '$app/stores'

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp]?.vernacularName)
    return glossingLanguages[bcp].vernacularName

  const { data: { t } } = get(page)
  return `${t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}`
}
