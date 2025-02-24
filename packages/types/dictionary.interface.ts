import type { IFirestoreMetaData } from 'sveltefirets'
import type { PartnerPhoto } from './photo.interface'

export interface IAbout extends IFirestoreMetaData {
  about: string
}

export interface IGrammar extends IFirestoreMetaData {
  grammar: string
}

export interface Citation extends IFirestoreMetaData {
  citation: string
}

export interface Partner extends IFirestoreMetaData {
  name: string
  logo?: PartnerPhoto
}
