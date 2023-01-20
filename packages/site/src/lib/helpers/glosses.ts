import type { IGloss } from '@living-dictionaries/types';

export function orderGlosses({ glosses, dictionaryGlossLanguages, $t, label = false }:
  {
    glosses: IGloss;
    dictionaryGlossLanguages: string[],
    $t: (id: string) => string,
    label?: boolean
  }
) {
  const sortedGlossLanguages = orderEntryAndDictionaryGlossLanguages(glosses, dictionaryGlossLanguages);
  const glossLanguagesWithGloss = sortedGlossLanguages.filter((bcp) => glosses[bcp])
  return glossLanguagesWithGloss.map((bcp) => {
    const gloss = glosses[bcp];
    if (label) return `${$t('gl.' + bcp)}: ${gloss}`;
    return gloss;
  });
}

export function orderEntryAndDictionaryGlossLanguages(
  glosses: IGloss,
  dictionaryGlossLanguages: string[]
) {
  const combinedGlossingLanguages = [...dictionaryGlossLanguages, ...Object.keys(glosses || {})]
  const deduplicatedGlossingLanguages = [...new Set(combinedGlossingLanguages)]
  return deduplicatedGlossingLanguages;
}
