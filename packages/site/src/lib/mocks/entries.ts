import type { GoalDatabaseEntry } from '@living-dictionaries/types';

export const mockEntries: { name: string, description?: string, entry: GoalDatabaseEntry}[] = [
  {
    name: 'multiple empty glosses',
    entry: {
      lx: '(h)æg-ko gag=tǝnǝ nlaʔ-pog',
      lo1: 'local orthography 1',
      lo2: 'local orthography 2',
      lo3: 'local orthography 3',
      sn: [
        {
          gl: {
            en: 'common jay butterfly',
            es: 'mariposa común jay',
            fr: 'papillon jay commun',
            pt: 'this is a very long gloss to simulate that sort of situation',
            il: null,
          },
          sdn: [
            '1.5',
            '1.9'
          ],
          pfs: [{
            path: 'gta/images/local_import/6-Common-jay-1580859671358.JPG',
            sc: 'local_import',
            gcs: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g\n'
          }],
          xs: [
            {
              en: 'Watch how the common jay butterfly flies.',
            }
          ],
          nc: '1'
        }
      ],
      scn: ['Graphium doson'],
      di: ['Hill'],
      sfs: [{
        path: 'gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3',
        ts: 1580860148537,
        speakerName: 'Budra Raspeda',
        sc: 'local_import'
      }],
      sr: ['Some cool guy in the village'],
      nt: 'recorded in 1998'
      // 'createdBy': 'OTD',
    }
  },
  {
    name: 'simple',
    entry: {
      lx: 'hello',
    }
  }
]


