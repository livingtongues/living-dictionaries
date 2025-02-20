import type { Tables } from '@living-dictionaries/types'
import { notifyAdminsOnNewDictionary } from './composeMessages'

test('composeAdminNotice returns', () => {
  const dictionary = {
    id: 'testID',
    gloss_languages: ['en', 'es'],
    name: 'Test-Dictionary',
    alternate_names: ['foo', 'bar'],
    language_used_by_community: true,
    community_permission: 'yes', // 'no' | 'unknown'
    author_connection: 'Something about how I know this community and more...',
    coordinates: {
      points: [{ coordinates: { latitude: 1, longitude: 2 } }],
    },
  } as Tables<'dictionaries'>
  const user = {
    email: 'jamesj@gmail.com',
  }
  expect(notifyAdminsOnNewDictionary(dictionary, user.email)).toMatchInlineSnapshot(`
    "Hey Admins,

      jamesj@gmail.com created a new Living Dictionary named Test-Dictionary. Here's the details:
      
      URL: https://livingdictionaries.app/testID 
      
      Glossing languages: en, es
      Alternate names: foo, bar
      
      Coordinates: lat: 1, lon: 2
      Location: 
      
      Public: Users can no longer make their dictionaries public.
      ISO 639-3: 
      Glottocode: 

      Language Used By a Community: true
      Community Permission: yes
      Author's Connection: "Something about how I know this community and more..."
      ConLang Description: "undefined"
      
      We sent an automatic dictionary-info email to jamesj@gmail.com, but you can also get in touch with them if needed.
      
      Thanks,
      Our automatic Vercel Function
      
      https://livingdictionaries.app"
  `)
})
