import type { IAudio } from './audio.interface';
import type { IVideo, IVideoCustomMetadata } from './video.interface';
import type { IDialect, IAlgoliaDialect } from './dialect.interface';
import type {
  IAbout,
  IDictionary,
  IGrammar,
  IPoint,
  IRegion,
  ICitation,
} from './dictionary.interface';
import type { IEntry } from './entry.interface';
import type { IGlossLanguages, IGlossLanguage } from './gloss-language.interface';
import type { IGloss } from './gloss.interface';
import type { IExampleSentence } from './exampe-sentence.interface';
import type { IImport } from './import.interface';
import type { IPhoto } from './photo.interface';
import type { ISemanticDomain } from './semantic-domain.interface';
import type { ISpeaker } from './speaker.interface';
import type { IUser } from './user.interface';
import type { IInvite } from './invite.interface';
import type { IDictionarySettings } from './dictionary-settings.interface';
import type { IPartOfSpeech } from './part-of-speech.interface';
import type { IColumn } from './column.interface';
import type { HelperRoles, IHelper } from './helper.interface';
import type { IPrintFields } from './print-entry.interface';

export type {
  IAudio,
  IVideo,
  IVideoCustomMetadata,
  IDialect,
  IAlgoliaDialect,
  IDictionarySettings,
  IDictionary,
  IAbout,
  IGrammar,
  ICitation,
  IEntry,
  IExampleSentence,
  IGlossLanguages,
  IGlossLanguage,
  IGloss,
  IImport,
  IInvite,
  IPhoto,
  ISemanticDomain,
  ISpeaker,
  IUser,
  IHelper,
  HelperRoles,
  IPartOfSpeech,
  IColumn,
  IPoint,
  IRegion,
  IPrintFields,
};

import { ReadyLocales, UnpublishedLocales } from './languages.interface';
import { CustomPrintFields, StandardPrintFields } from './print-entry.interface';
export { ReadyLocales, UnpublishedLocales, CustomPrintFields, StandardPrintFields };
