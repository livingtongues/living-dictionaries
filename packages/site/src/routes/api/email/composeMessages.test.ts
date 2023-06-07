import { IDictionary, IUser } from '@living-dictionaries/types';
import { notifyAdminsOnNewDictionary } from './composeMessages';

test('composeAdminNotice returns', () => {
  const dictionary: IDictionary = {
    glossLanguages: ['en', 'es'],
    name: 'Test-Dictionary',
    entryCount: 0,
    alternateNames: ['foo', 'bar'],
    languageUsedByCommunity: true,
    communityPermission: 'yes', // 'no' | 'unknown'
    authorConnection: 'Something about how I know this community and more...',

    // @ts-ignore
    coordinates: {
      latitude: 1,
      longitude: 2,
    },
  };
  const user: IUser = {
    displayName: 'James Johnson',
    email: 'jamesj@gmail.com',
  };
  expect(notifyAdminsOnNewDictionary(dictionary, 'testID', user)).toMatchInlineSnapshot(`
    "Hey Admins,
    
      James Johnson created a new Living Dictionary named Test-Dictionary. Here's the details:
      
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
      Author's Connection: \\"Something about how I know this community and more...\\"
      ConLang Description: \\"undefined\\"
      
      We sent James Johnson an automatic dictionary-info email to jamesj@gmail.com, but you can also get in touch with them if needed.
      
      Thanks,
      Our automatic Firebase Cloud Function
      
      https://livingdictionaries.app"
  `);
});