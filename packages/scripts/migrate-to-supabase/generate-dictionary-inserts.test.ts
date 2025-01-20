import { generate_dictionary_inserts } from './generate-dictionary-inserts'
import type { IDictionary } from './types'

test(generate_dictionary_inserts, () => {
  const sql = generate_dictionary_inserts([{
    id: '-glossary585',
    name: 'قاموس المصطلحات',
    glossLanguages: [
      'en',
      'ar',
    ],
    alternateNames: [
      'glossary',
    ],
    entryCount: 0,
    iso6393: 'arb',
    glottocode: 'eng',
    languageUsedByCommunity: true,
    communityPermission: 'yes',
    authorConnection: 'Arabic is the third most widespread official language after English and French,[16] one of six official languages of the United Nations,[17] and the liturgical language of Islam.[18] Arabic is widely taught in schools and universities around the world and is used to varying degrees in workplaces, governments and the media.[18] During the Middle Ages, Arabic was a major vehicle of culture and learning, especially in science, mathematics and philosophy. As a result, many European languages have borrowed words from it. Arabic influence, mainly in vocabulary, is seen in European languages (mainly Spanish and to a lesser extent Portuguese, Catalan, and Sicilian) owing to the proximity of Europe and the long-lasting Arabic cultural and linguistic presence, mainly in Southern Iberia, during the Al-Andalus era. Maltese is a Semitic language developed from a dialect of Arabic and written in the Latin alphabet.[19] The Balkan languages, including Albanian, Greek, Serbo-Croatian, and Bulgarian, have also acquired many words of Arabic origin, mainly through direct contact with Ottoman Turkish.',
    createdBy: 'NMR122L1cMWGMfl7HsHKLB7KnZX2',
    updatedBy: 'NMR122L1cMWGMfl7HsHKLB7KnZX2',
    createdAt: {
      // @ts-expect-error
      _seconds: 1732273172,
      _nanoseconds: 680000000,
    },
    location: '-',
    updatedAt: {
      _seconds: 1732274159,
      _nanoseconds: 17000000,
    },
  }] as IDictionary[])
  expect(sql.slice(0, 1000)).toMatchInlineSnapshot(`
    "INSERT INTO dictionaries ("alternate_names", "author_connection", "community_permission", "con_language_description", "coordinates", "copyright", "created_at", "created_by", "featured_image", "gloss_languages", "glottocode", "hide_living_tongues_logo", "id", "iso_639_3", "language_used_by_community", "location", "metadata", "name", "orthographies", "print_access", "public", "updated_at", "updated_by") VALUES
    ('{glossary}', 'Arabic is the third most widespread official language after English and French,[16] one of six official languages of the United Nations,[17] and the liturgical language of Islam.[18] Arabic is widely taught in schools and universities around the world and is used to varying degrees in workplaces, governments and the media.[18] During the Middle Ages, Arabic was a major vehicle of culture and learning, especially in science, mathematics and philosophy. As a result, many European languages have borrowed words from it. Arabic influence, mainly in vocabulary, is seen in"
  `)
})
