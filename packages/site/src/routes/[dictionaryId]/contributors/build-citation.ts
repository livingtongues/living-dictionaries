import type { TranslateOptions } from '$lib/i18n';
import type { TranslateFunction, TranslationKeys } from '$lib/i18n/types';
import type { IDictionary, Partner } from '@living-dictionaries/types';

export function build_citation({t, dictionary, custom_citation, partners}: {
  t: TranslateFunction
  dictionary: IDictionary
  custom_citation?: string
  partners?: Partner[]
}): string {
  let citation = ''

  if (custom_citation)
    citation += custom_citation + ' '

  const year = new Date().getFullYear()
  citation += year + '. '

  const dictionary_title = t('dictionary.full_title', { values: { dictionary_name: dictionary.name }})
  citation += dictionary_title + '. '

  const partner_names = (partners || []).map(({name}) => name)

  const all_parties: string[] = partner_names
  if (!dictionary.hideLivingTonguesLogo)
    all_parties.unshift('Living Tongues Institute for Endangered Languages')

  if (all_parties.length)
    citation += all_parties.join(', ') + '. '

  const url = `https://livingdictionaries.app/${dictionary.id}`
  return citation + url
}


if (import.meta.vitest) {
  const t = (key: TranslationKeys, { values: { dictionary_name }}: TranslateOptions) => `${dictionary_name} Living Dictionary`
  const dictionary: IDictionary = {
    id: 'traba',
    name: 'Trabajar'
  } as IDictionary

  describe(build_citation, () => {
    test('default', () => {
      const citation = build_citation({t, dictionary})
      expect(citation).toEqual('2024. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/traba');
    });

    test('custom citation', () => {
      const citation = build_citation({t, dictionary, custom_citation: 'Hoctur, B.J.'})
      expect(citation).toEqual('Hoctur, B.J. 2024. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/traba');
    });

    test('two partners', () => {
      const citation = build_citation({t, dictionary, partners: [{name: 'The Language Team'}, {name: 'Hawaiian Linguistic Club'}]})
      expect(citation).toEqual('2024. Trabajar Living Dictionary. Living Tongues Institute for Endangered Languages, The Language Team, Hawaiian Linguistic Club. https://livingdictionaries.app/traba');
    });

    test('one partner, hide Living Tongues', () => {
      const citation = build_citation({t, dictionary: {...dictionary, hideLivingTonguesLogo: true}, partners: [{name: 'The Language Team'}]})
      expect(citation).toEqual('2024. Trabajar Living Dictionary. The Language Team. https://livingdictionaries.app/traba');
    });

    test('hide Living Tongues', () => {
      const citation = build_citation({t, dictionary: {...dictionary, hideLivingTonguesLogo: true}})
      expect(citation).toEqual('2024. Trabajar Living Dictionary. https://livingdictionaries.app/traba');
    });
  });
}


// {citation?.citation ? citation.citation + ' ' : ''}
// {new Date().getFullYear()}.
// <span>{$page.data.t('dictionary.full_title', { values: { dictionary_name: dictionary.name }})}.</span>
// {!hideLivingTonguesLogo ? 'Living Tongues Institute for Endangered Languages' : ''}{partners?.length && !hideLivingTonguesLogo ? ', ' : ''}{partners?.length ? partners.map(partner => partner.name).join(', ') : ''}. https://livingdictionaries.app/{dictionary.id}
