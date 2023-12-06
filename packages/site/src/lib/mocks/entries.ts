import { en } from '$lib/i18n';
import type { TranslateFunction } from '$lib/i18n/types';
import { expand_entry } from '$lib/transformers/expand_entry';
import type { ExpandedEntry, GoalDatabaseEntry } from '@living-dictionaries/types';

export const butterfly_google_storage_url = 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g'

const complexData: GoalDatabaseEntry = {
  lx: '(h)æg-ko gag=tǝnǝ nlaʔ-pog',
  ph: 'hæg-ko gag=tǝnǝ nlaʔ-pog',
  mr: 'morphology',
  in: '3SG-POSS sit-PROG',
  lo1: 'local way of writing',
  sn: [
    {
      gl: {
        en: 'common jay butterfly',
        fr: 'papillon jay commun',
        pt: 'this is a very long gloss to simulate that sort of situation where it is ridiculously long',
        il: null,
      },
      ps: ['n', 'v'],
      sdn: [
        '1.5',
        '1.9'
      ],
      sd: ['Flying Mammals', 'Flying Insects'],
      pfs: [{
        path: 'gta/images/local_import/6-Common-jay-1580859671358.JPG',
        sc: 'local_import',
        gcs: butterfly_google_storage_url
      }],
      xs: [
        {
          en: 'Watch how the common jay butterfly flies.',
          vn: 'A vernacular sentence.',
        }
      ],
      nc: '1'
    }
  ],
  scn: ['Graphium doson'],
  di: ['Hill', 'Southern Berm'],
  sfs: [{
    path: 'gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3',
    ts: 1580860148537,
    speakerName: 'Budra Raspeda',
    sc: 'local_import'
  }],
  sr: ['Some cool guy in the village'],
  nt: `recorded in 1998, <img src=x" onerror="alert('XSS Attack will be sanitized')">`,
  // 'createdBy': 'OTD',
  id: '1', // for table
}

const hebrewData: GoalDatabaseEntry = {
  lx: 'אילא',
  sn: [
    {
      gl: {
        en: 'hand',
        he: 'יָד'
      },
      xs: [
        {
          en: 'My hand does not reach.',
          he: 'הַיָּד שֶׁלִּי לֹא מַגִּיעָה',
          vn: 'אִילָא דִּידִי לָא מַתְיָא',
        }
      ],
    }
  ],
  id: '4', // for table
}

const t = (({dynamicKey: key}: { dynamicKey: string}) => {
  const [section, item] = key.split('.')
  return en[section][item];
}) as TranslateFunction

export const complex: ExpandedEntry = expand_entry(complexData, t);

export const hebrew: ExpandedEntry = expand_entry(hebrewData, t);

export const simple: ExpandedEntry = {
  lexeme: 'hello',
  elicitation_id: '123',
  id: '2', // for table
}

export const hasVideo: ExpandedEntry = {
  lexeme: 'running through the forest',
  senses: [
    {
      video_files: [{
        fb_storage_path: 'not-real-path',
        uid_added_by: '123',
      }],
    }
  ],
  id: '3', // for table
}
