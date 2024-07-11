// BCP 47 language codes are used to identify correct Keyman keyboards for language inputs
// Codes pulled from: http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
// internalName pulled from: https://keyman.com/keyboards > search for keyboard, select one with desktop and mobile web if possible, then copy Keyboard ID. Alternatively, all keyboards available can be seen at https://keyman.com/developer/keymanweb/keyboards
// Latin script options: european, sil_euro_latin, basic_kbdus, us

import type { IGlossLanguages } from '@living-dictionaries/types'
import glossing_languages_list from './glossing-languages-list.json'

export const glossingLanguages: IGlossLanguages = glossing_languages_list

export const additionalKeyboards: IGlossLanguages = {
  'srb-sora': {
    vernacularName: 'Sora',
    internalName: 'basic_kbdsora',
    showKeyboard: true,
  },
  'sat-olck': {
    vernacularName: 'Santhali Ol Chiki',
    internalName: 'basic_kbdolch',
    showKeyboard: true,
  },
}

export type Glossing_Languages = keyof typeof glossing_languages_list
