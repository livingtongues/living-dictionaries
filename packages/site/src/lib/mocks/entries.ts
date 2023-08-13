import { expand_entry } from '$lib/transformers/expand_entry';
import type { GoalDatabaseEntry } from '@living-dictionaries/types';

export const mockEntries: { name: string, description?: string, entry: GoalDatabaseEntry}[] = [
  {
    name: 'multiple empty glosses',
    entry: {
      lx: '(h)æg-ko gag=tǝnǝ nlaʔ-pog',
      ph: 'hæg-ko gag=tǝnǝ nlaʔ-pog',
      mr: 'morphology',
      in: '3SG-POSS sit-PROG',
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
          ps: ['n', 'v'],
          sdn: [
            '1.5',
            '1.9'
          ],
          sd: ['Flying Mammals', 'Flying Insects'],
          pfs: [{
            path: 'gta/images/local_import/6-Common-jay-1580859671358.JPG',
            sc: 'local_import',
            gcs: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g\n'
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
    }
  },
  {
    name: 'simple',
    entry: {
      lx: 'hello',
    }
  }
]


export const mock_expanded_entries = mockEntries.map(entry => {
  return {
    name: entry.name,
    description: entry.description,
    entry: expand_entry(entry.entry),
  };
});