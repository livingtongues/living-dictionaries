import type { IDictionary, IUser } from '@living-dictionaries/types';

export function notifyAdminsOnNewDictionary(dictionary: IDictionary, user: IUser) {
  return `Hey Admins,

  ${user.displayName} created a new Living Dictionary named ${dictionary.name}. Here's the details:
  
  URL: https://livingdictionaries.app/${dictionary.id} 
  
  Glossing languages: ${dictionary.glossLanguages.join(', ')}
  Alternate names: ${dictionary.alternateNames ? dictionary.alternateNames.join(', ') : ''}
  
  Coordinates: ${
    dictionary.coordinates
      ? 'lat: ' + dictionary.coordinates.latitude + ', lon: ' + dictionary.coordinates.longitude
      : ''
  }
  Location: ${dictionary.location ? dictionary.location : ''}
  
  Public: Users can no longer make their dictionaries public.
  ISO 639-3: ${dictionary.iso6393 ? dictionary.iso6393 : ''}
  Glottocode: ${dictionary.glottocode ? dictionary.glottocode : ''}

  Language Used By a Community: ${dictionary.languageUsedByCommunity}
  Community Permission: ${dictionary.communityPermission}
  Author's Connection: "${dictionary.authorConnection}"
  ConLang Description: "${dictionary.conLangDescription}"
  
  We sent ${user.displayName} an automatic dictionary-info email to ${
    user.email
  }, but you can also get in touch with them if needed.
  
  Thanks,
  Our automatic Firebase Cloud Function
  
  https://livingdictionaries.app`;
}
