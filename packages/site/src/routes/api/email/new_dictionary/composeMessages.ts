import type { Tables } from '@living-dictionaries/types'

export function notifyAdminsOnNewDictionary(dictionary: Tables<'dictionaries'>, email: string) {
  return `Hey Admins,

  ${email} created a new Living Dictionary named ${dictionary.name}. Here's the details:
  
  URL: https://livingdictionaries.app/${dictionary.id} 
  
  Glossing languages: ${dictionary.gloss_languages.join(', ')}
  Alternate names: ${dictionary.alternate_names ? dictionary.alternate_names.join(', ') : ''}
  
  Coordinates: ${
  dictionary.coordinates?.points?.[0]
    ? `lat: ${dictionary.coordinates.points[0].coordinates.latitude}, lon: ${dictionary.coordinates.points[0].coordinates.longitude}`
    : ''
}
  Location: ${dictionary.location ? dictionary.location : ''}
  
  Public: Users can no longer make their dictionaries public.
  ISO 639-3: ${dictionary.iso_639_3 ? dictionary.iso_639_3 : ''}
  Glottocode: ${dictionary.glottocode ? dictionary.glottocode : ''}

  Language Used By a Community: ${dictionary.language_used_by_community}
  Community Permission: ${dictionary.community_permission}
  Author's Connection: "${dictionary.author_connection}"
  ConLang Description: "${dictionary.con_language_description}"
  
  We sent an automatic dictionary-info email to ${email}, but you can also get in touch with them if needed.
  
  Thanks,
  Our automatic Vercel Function
  
  https://livingdictionaries.app`
}
