import type { PartnerWithPhoto, Tables } from '@living-dictionaries/types'
import type { TranslateOptions } from '$lib/i18n'
import type { TranslateFunction, TranslationKeys } from '$lib/i18n/types'

export function build_citation({ t, dictionary, custom_citation, partners }: {
  t: TranslateFunction
  dictionary: Tables<'dictionaries'>
  custom_citation?: string
  partners?: PartnerWithPhoto[]
}): string {
  let citation = custom_citation ? `${custom_citation} ` : ''

  const year = new Date().getFullYear()
  citation += `${year}. `

  const dictionary_title = t('dictionary.full_title', { values: { dictionary_name: dictionary.name } })
  citation += `${dictionary_title}. `

  const partner_names = (partners || []).map(({ name }) => name)
  const all_partners = [
    dictionary.hide_living_tongues_logo ? [] : ['Living Tongues Institute for Endangered Languages'],
    partner_names,
  ].flat()

  if (all_partners.length)
    citation += `${all_partners.join(', ')}. `

  const url = `https://livingdictionaries.app/${dictionary.id}`
  return citation + url
}

if (import.meta.vitest) {
  const t = (key: TranslationKeys, { values: { dictionary_name } }: TranslateOptions) => `${dictionary_name} Living Dictionary`
  const dictionary = { id: 'traba', name: 'Trabajar' } as Tables<'dictionaries'>

  describe(build_citation, () => {
    test('default', () => {
      const citation = build_citation({ t, dictionary })
      expect(citation).toEqual('2026. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/traba')
    })

    test('custom citation', () => {
      const citation = build_citation({ t, dictionary, custom_citation: 'Hoctur, B.J.' })
      expect(citation).toEqual('Hoctur, B.J. 2026. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/traba')
    })

    test('two partners', () => {
      const citation = build_citation({ t, dictionary, partners: [{ name: 'The Language Team' }, { name: 'Hawaiian Linguistic Club' }] as PartnerWithPhoto[] })
      expect(citation).toEqual('2026. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages, The Language Team, Hawaiian Linguistic Club. https://livingdictionaries.app/traba')
    })

    test('one partner, hide Living Tongues', () => {
      const citation = build_citation({ t, dictionary: { ...dictionary, hide_living_tongues_logo: true }, partners: [{ name: 'The Language Team' }] as PartnerWithPhoto[] })
      expect(citation).toEqual('2026. Trabajar Living Dictionary. The Language Team. https://livingdictionaries.app/traba')
    })

    test('hide Living Tongues', () => {
      const citation = build_citation({ t, dictionary: { ...dictionary, hide_living_tongues_logo: true } })
      expect(citation).toEqual('2026. Trabajar Living Dictionary. https://livingdictionaries.app/traba')
    })
  })
}
