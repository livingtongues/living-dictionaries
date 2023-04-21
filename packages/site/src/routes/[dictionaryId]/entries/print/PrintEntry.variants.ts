import type { IPrintFields } from '@living-dictionaries/types';
import type { Variants } from 'kitbook';
import type Component from './PrintEntry.svelte';

const height = 110;
export const variants: Variants<typeof Component> = [
  {
    name: 'multiple empty glosses',
    description: 'needs fixed',
    width: 300,
    height: 200,
    props: {
      entry: {
        "sdn": [
          "1.5",
          "1.9"
        ],
        "gl": {
          "en": "Graphium doson, common jay butterfly",
          es: "",
          il: "",
          fr: null,
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
    width: 300,
    height: 300,
    props: {
      entry: {
        "sdn": [
          "1.5",
          "1.9"
        ],
        "gl": {
          "en": "Graphium doson, common jay butterfly",
          "es": "I just made this up, sorry that this isn't actually Spanish or anything useful. It's just here to make the lines wrap.",
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
    name: 'sound file',
    height,
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
    name: 'no gloss (p.s. it should be hair)',
    height,
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
].map(v => {
  const selectedFields: IPrintFields = {
    gloss: true,
    alternateOrthographies: true,
    ph: true,
    ps: true,
    example_sentence: true,
    sdn: true,
    in: true,
    mr: false,
    nc: false,
    pl: false,
    va: false,
    di: false,
    nt: false,
    image: true,
    speaker: false,
    sr: false,
    id: false,
  };

  return {
    ...v,
    props: {
      dictionaryId: 'gta',
      selectedFields,
      ...v.props,
    }
  }
});
