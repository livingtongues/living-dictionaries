import { GeoPoint } from 'firebase-admin/firestore'
import type { IDictionary } from '@living-dictionaries/types'
import { db } from '../config-firebase'
import { tdLocations } from './tdv1-dictionaries';

(() => {
  try {
    tdLocations.forEach(async (dictionary) => {
      if (dictionary.properties.icon === 'library-15') {
        const [,dictionaryUrl] = dictionary.properties.xlink.match(/http:\/\/talkingdictionary.org\/(.+)/)
        const data: Partial<IDictionary> = {
          name: dictionary.properties.label,
          population: dictionary.properties.size,
          publishYear: dictionary.properties.date,
          coordinates: new GeoPoint(
            dictionary.geometry.coordinates[1],
            dictionary.geometry.coordinates[0],
          ),
          url: dictionary.properties.xlink,
          type: 'tdv1',
        }
        if (dictionary.properties.thumbnail)
          data.thumbnail = dictionary.properties.thumbnail

        await db.doc(`dictionaries/tdv1-${dictionaryUrl}`).set(data)
      }
    })
  } catch (err) {
    console.log(err)
  }
})()
