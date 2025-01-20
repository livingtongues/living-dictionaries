import type { TablesInsert } from '@living-dictionaries/types'
import { sql_file_string } from '../import/to-sql-string'
import { jacob_ld_user_id } from '../constants'
import type { IDictionary } from './types'
import { get_supabase_user_id_from_firebase_uid } from './get-user-id'

export function generate_dictionary_inserts(dictionaries: IDictionary[]): string {
  let sql_statements = ''

  for (const firebase_dictionary of dictionaries) {
    const { id, name, alternateNames, glossLanguages, location, iso6393, glottocode, coordinates, points, regions, public: is_public, printAccess, copyright, alternateOrthographies, languageUsedByCommunity, authorConnection, communityPermission, conLangDescription, featuredImage, hideLivingTonguesLogo, publishYear, population, thumbnail, url, type, createdAt, createdBy, updatedAt, updatedBy } = firebase_dictionary

    const created_by = get_supabase_user_id_from_firebase_uid(createdBy) || jacob_ld_user_id
    // @ts-expect-error
    const created_at_seconds = createdAt?._seconds || updatedAt?._seconds
    const created_at = created_at_seconds ? seconds_to_timestamp_string(created_at_seconds) : new Date().toISOString()

    let metadata: TablesInsert<'dictionaries'>['metadata'] = null
    if (publishYear
      || population
      || thumbnail
      || url
      || type) {
      metadata = {
        ...(publishYear && { publish_year: publishYear }),
        ...(population && { population }),
        ...(thumbnail && { thumbnail }),
        ...(url && { url }),
        ...(type && { type }),
      }
    }

    let combined_coordinates: TablesInsert<'dictionaries'>['coordinates'] = null

    if (firebase_dictionary.coordinates === null) {
      delete firebase_dictionary.coordinates
    }
    if (coordinates || points || regions) {
      if (coordinates?._lat && coordinates?._long) {
        combined_coordinates = {
          points: [{ coordinates: { latitude: coordinates._lat, longitude: coordinates._long } }],
        }
        delete firebase_dictionary.coordinates
      }
      if (coordinates?._longitude && coordinates?._latitude) {
        combined_coordinates = {
          points: [{ coordinates: { latitude: coordinates._latitude, longitude: coordinates._longitude } }],
        }
        delete firebase_dictionary.coordinates
      }
      if (coordinates?.longitude !== undefined && coordinates?.latitude !== undefined) {
        combined_coordinates = {
          points: [{ coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude } }],
        }
        delete firebase_dictionary.coordinates
      }
      if (points) {
        combined_coordinates = {
          ...combined_coordinates,
          points: [...combined_coordinates?.points || [], ...points],
        }
        delete firebase_dictionary.points
      }
      if (regions) {
        combined_coordinates = {
          ...combined_coordinates,
          regions,
        }
        delete firebase_dictionary.regions
      }
    }

    const dictionary: TablesInsert<'dictionaries'> = {
      id,
      name,
      alternate_names: alternateNames,
      orthographies: alternateOrthographies ? alternateOrthographies.map(name => ({ bcp: '', name: { default: name } })) : null,
      author_connection: authorConnection,
      community_permission: communityPermission,
      con_language_description: conLangDescription,
      location,
      coordinates: combined_coordinates,
      copyright,
      featured_image: featuredImage,
      gloss_languages: glossLanguages,
      glottocode,
      hide_living_tongues_logo: hideLivingTonguesLogo,
      iso_639_3: iso6393,
      language_used_by_community: languageUsedByCommunity,
      metadata,
      print_access: printAccess,
      public: !!is_public,
      created_at,
      created_by,
      // @ts-expect-error
      updated_at: updatedAt?._seconds ? seconds_to_timestamp_string(updatedAt._seconds) : created_at,
      updated_by: get_supabase_user_id_from_firebase_uid(updatedBy) || created_by,
    }

    delete firebase_dictionary.id
    delete firebase_dictionary.name
    delete firebase_dictionary.alternateNames
    delete firebase_dictionary.glossLanguages
    delete firebase_dictionary.location
    delete firebase_dictionary.iso6393
    delete firebase_dictionary.glottocode

    delete firebase_dictionary.public
    delete firebase_dictionary.printAccess
    delete firebase_dictionary.copyright
    delete firebase_dictionary.alternateOrthographies
    delete firebase_dictionary.languageUsedByCommunity
    delete firebase_dictionary.authorConnection
    delete firebase_dictionary.communityPermission
    delete firebase_dictionary.conLangDescription
    delete firebase_dictionary.featuredImage
    delete firebase_dictionary.hideLivingTonguesLogo
    delete firebase_dictionary.publishYear
    delete firebase_dictionary.population
    delete firebase_dictionary.thumbnail
    delete firebase_dictionary.url
    delete firebase_dictionary.type
    delete firebase_dictionary.createdAt
    delete firebase_dictionary.createdBy
    delete firebase_dictionary.updatedAt
    delete firebase_dictionary.updatedBy
    delete firebase_dictionary.entryCount
    delete firebase_dictionary.videoAccess
    delete firebase_dictionary.allContribute
    // @ts-expect-error
    delete firebase_dictionary.lo

    if (Object.keys(firebase_dictionary).length !== 0) {
      console.log({ firebase_dictionary })
      throw new Error('Entry not fully converted')
    }

    const sql = sql_file_string('dictionaries', dictionary, 'UPSERT')
    sql_statements += sql
  }

  return sql_statements
}

function seconds_to_timestamp_string(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}
