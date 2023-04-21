import type { Variants } from 'kitbook';
import type Component from './ListEntry.svelte';
import type { IDictionary } from '@living-dictionaries/types';

const dictionary: IDictionary = {
  id: 'foo',
  name: 'Foo',
  glossLanguages: ['en', 'es'],
}

export const variants: Variants<typeof Component> = [
  {
    name: 'complete',
    height: 150,
    props: {
      entry: {
        "sdn": [
          "1.5",
          "1.9"
        ],
        "gl": {
          "en": "Graphium doson, common jay butterfly",
        },
        "di": "Hill",
        "pf": {
          "path": "gta/images/local_import/6-Common-jay-1580859671358.JPG",
          "source": "local_import",
          "gcs": "LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g\n"
        },
        "sd": null,
        "sf": {
          "path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
          ts: 1580860148537,
          "speakerName": "Budra Raspeda",
          "source": "local_import"
        },
        "createdBy": "OTD",
        "lx": "(h)æg-ko gag=tǝnǝ nlaʔ-pog",
        "id": "HUW1umElFA8Uvjww8VCb"
      }
    },
  },
  {
    name: 'long gloss',
    height: 150,
    props: {
      entry: {
        "sdn": [
          "1.5",
          "1.9"
        ],
        "gl": {
          "en": "Graphium doson, common jay butterfly",
          "es": "I just made this up, this isn't actually Spanish or anything useful. It's just here to make the lines wrap a bit.",
        },
        "di": "Hill",
        "pf": {
          "path": "gta/images/local_import/6-Common-jay-1580859671358.JPG",
          "source": "local_import",
          "gcs": "LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g\n"
        },
        "sd": null,
        "sf": {
          "path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
          ts: 1580860148537,
          "speakerName": "Budra Raspeda",
          "source": "local_import"
        },
        "createdBy": "OTD",
        "lx": "(h)æg-ko gag=tǝnǝ nlaʔ-pog",
        "id": "HUW1umElFA8Uvjww8VCb"
      }
    },
  },
  {
    name: 'no sound file - cannot edit',
    props: {
      entry: {
        "di": "Hill",
        "createdBy": "OTD",
        "sdn": [
          "10.9"
        ],
        "nt": "2011 Tikorapoda",
        "lx": "a-dʒa",
        "gl": {
          "en": "whom"
        },
        "id": "RdaOfXwRhP7uBVDvzzBd"
      }
    },
  },
  {
    name: 'no sound file - can edit',
    props: {
      entry: {
        "di": "Hill",
        "createdBy": "OTD",
        "sdn": [
          "10.9"
        ],
        "nt": "2011 Tikorapoda",
        "lx": "a-dʒa",
        "gl": {
          "en": "whom"
        },
        "id": "RdaOfXwRhP7uBVDvzzBd"
      },
      canEdit: true,
    },
  },
  {
    name: 'sound file',
    props: {
      entry: {
        "sd": null,
        "gl": {
          "en": "fearless"
        },
        "createdBy": "OTD",
        "lx": "a-bʈiŋmajg=tǝ",
        "di": "Hill",
        "sdn": [
          "3.2"
        ],
        "sf": {
          "source": "local_import",
          ts: 1580860148537,
          "path": "gta/audio/local_import/Gta-BR-Tkrpr-11-11-fearless-1580859678428.mp3",
          "speakerName": "Budra Raspeda"
        },
        "nt": "2011 Tikorapoda",
        "id": "yZB1c77QklFjABlfMDm1"
      }
    },
  },
  {
    name: 'no gloss',
    props: {
      entry: {
        "lx": "[n]hug-boʔ",
        "sf": {
          "source": "local_import",
          ts: 1580860148537,
          "speakerName": "Budra Raspeda",
          "path": "gta/audio/local_import/2010-9-26-Gta-nhugbo-hair-1580862091120.mp3"
        },
        "sdn": [
          "2.1"
        ],
        "createdBy": "OTD",
        "di": "Hill",
        "gl": {
          "en": null
        },
        "id": "xMnDS5aHSfemIdSpacN8"
      }
    }
  }
].map(variant => {
  return {
    height: 110,
    ...variant,
    props: {
      dictionary,
      ...variant.props,
    },
  }
})