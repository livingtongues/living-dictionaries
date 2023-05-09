import type { IEntry, ISpeaker } from "@living-dictionaries/types";

const gender: 'm' | 'f' | 'o' = 'f';

export const speakers: ISpeaker[] = [
  {
    birthplace: 'russia',
    contributingTo: ['bezhta'],
    decade: 4,
    displayName: 'zaira',
    gender: gender,
    uid: 'uwNgSHCEeRaJAUPsmZok1uMRXzO2',
  },
];

export const entries: IEntry[] = [
  {
    id: '12345qwerty',
    lx: 'xiangjiao',
    gl: { es: 'platano', ar: `<img src="x" onerror="alert('XSS attack')">`, en: 'banana' },
    lo: 'کیلا',
    lo2: 'یaلا',
    lo3: 'check_lo3',
    in: 'n',
    mr: 'bar',
    nc: '5',
    ph: 'xiangjiao',
    ps: 'n',
    pl: 'shuang xiangjiao',
    sd: ['Plants'],
    sdn: ['2.1', '2.2', '2.3'],
    di: 'West Zimbizi',
    nt: `This is an example of a note, here we can write whatever we want. <img src=x" onerror="alert('XSS Attack')">`, // will be sanitized
    sr: ['A book', 'www.mybook.com'],
    xs: { en: 'This is a banana', vn: '我很喜歡吃香蕉' },
    sf: { path: 'https://database.com/sound.mp3', speakerName: 'Bob Smith' },
    pf: {
      gcs: 'Ktt_Jvk55Mp1cHJ6_zXeHU6dEJOjh8p5bk3rvK5kzXVgwB8GDXCSOPipNTveouELfx9_Rh4IllVvS3BLFBTc',
    },
    xv: '',
  },
  {
    id: '34qw',
    lx: 'tree',
    gl: { es: 'arbol' },
    pf: {
      gcs: 'Ktt_Jvk55Mp1cHJ6_zXeHU6dEJOjh8p5bk3rvK5kzXVgwB8GDXCSOPipNTveouELfx9_Rh4IllVvS3BLFBTc',
      source: 'local_import',
    },
  },
  {
    ph: 'tato',
    di: '',
    lo: '',

    nt: '',
    xv: '',
    ps: 'n',
    sdn: ['1.2'],
    lx: 'тато',
    sf: {
      path: 'audio/bezhta/0860Y6h3Nnl63tiD6UWX_1591201519424.wav',
      ab: 'uwNgSHCEeRaJAUPsmZok1uMRXzO2',
      sp: 'uwNgSHCEeRaJAUPsmZok1uMRXzO2',
      ts: 1580860148537,
    },
    updatedBy: 'uwNgSHCEeRaJAUPsmZok1uMRXzO2',
    gl: {
      en: 'mud',
      ru: 'грязь',
    },
    id: '0860Y6h3Nnl63tiD6UWX',
    createdBy: 'uwNgSHCEeRaJAUPsmZok1uMRXzO2',
    in: '',
  },
  {
    nt: 'akateko_Juan-Diego-Mat-as_07Aug2014-1349_mother-8217-s-mother.wav recorded directly on 07Aug2014-1349 by Juan Diego Matías; ',
    sdn: ['2.6'],
    ps: 'inal.n',
    xs: {
      vernacular: 'abuela materna',
    },
    lx: 'chikay',
    gl: {
      en: "mother's mother",
    },
    di: 'término de parentesco',
    ub: '9yznFRnjuNOcdZf8ZGW16xDLkFh1',
    pf: {
      source: 'local_import',
      gcs: 'lwNfI3yEZ2ZOLwFXl_zxW8DPcjpbUvAGZL0aacvYRbw8JpMsFVlq5-y63CwDYd_cSwrFlYX2_O6I7jqwPGxV4A\n',
    },
    createdBy: 'OTD',
    ph: 'ʧ͡i.kaj',
    sf: {
      path: 'akateko/audio/local_import/akateko-Juan-Diego-Mat-as-07Aug2014-1349-mother-8217-s-mother-1581896570161.mp3',
      speakerName: 'Juan Diego Matías',
      source: 'local_import',
      ts: 1580860148537,
    },
    id: 'A9L0NWFc7xiLrWWqrmNh',
  },
  {
    di: 'Hill',
    lx: '(h)ozartũã',
    createdBy: 'OTD',
    sdn: ['7.1'],
    sd: null,
    gl: {
      en: 'thousand',
    },
    sf: {
      source: 'local_import',
      path: 'gta/audio/local_import/Gta-BR-Tkrpr-11-11-thousand-1580859670382.mp3',
      ts: 1580860148537,
      speakerName: 'Budra Raspeda',
    },
    nt: '2011 Tikorapoda',
    id: '2tND9w3BROP4c3kauN03',
  },
  {
    gl: {
      en: 'swing (vb.), shake (tr. vb.); hang up, unfurl; suspend[ed]',
    },
    di: 'Hill',
    nt: '2011 Tikorapoda',
    sf: {
      path: 'gta/audio/local_import/Gta-BR-Tkrpr-11-11-hang-up-swing-1580859669274.mp3',
      source: 'local_import',
      speakerName: 'Budra Raspeda',
      ts: 1580860148537,
    },
    sdn: ['6'],
    createdBy: 'OTD',
    lx: '(b)aʔdʒur',
    ub: 'T4qikh1eTafizvpmHNcG29uRQ2j1',
    ps: '',
    id: 'j8iVvJkiFBT7JcvLvNdk',
  },
  {
    lx: '(ɖ)nejʔpar',
    createdBy: 'OTD',
    gl: {
      en: 'urinal, latrine',
    },
    nt: '2011 Tikorapoda',
    di: 'Hill',
    sf: {
      speakerName: 'Budra Raspeda',
      path: 'gta/audio/local_import/Gta-BR-Tkrpr-11-11-latrine-2-1580859676385.mp3',
      ts: 1580860148537,
      source: 'local_import',
    },
    sdn: ['5.1', '5.5'],
    sd: null,
    id: 'wAcMha8FGpnOL13MsyfT',
  },
  {
    lx: "surdaənsoloso'ji",
    sf: {
      sc: 'local_import',
      speakerName: 'Somari Sabar',
      path: 'sora/audio/local_import/Sora_big_dog_female_pl_PSI_160-1589122747233.wav',
    },
    lo2: '𑃐𑃥𑃝𑃢 𑃢𑃙𑃐𑃦𑃘𑃦𑃐𑃦-𑃠𑃤',
    gl: {
      or: 'ବଡ ମାଇ କୁକୁର ଗୁଡିକ',
      hi: 'बड़ी कुत्तीयां',
      as: 'ডাঙৰ মাইকী কুকুৰ কেইজনী',
      en: 'big female dogs',
    },
    lo: "চুড়া আ্নচ'ল'চঃজি",
    di: 'West Bengal Sabar',
    ph: 'suɽa ənsolosoʔdʒi',
    sdn: ['1', '1.5', '7.2'],
    in: 'big female dog-PL',
    ps: 'ap',
    mr: 'suɽa ənsolo soʔ-dʒi',
    ii: 'v3-1589122736839',
    id: 'qd0HhcZKxqPX1x1MXKvw',
  },
  {
    lx: 'aben bar hoɽ kʰatir',
    ph: 'aben bar hoɽ kʰatir',
    sdn: [],
    lo: 'अबेन बार होड़ खातिर',
    gl: {
      hi: 'तुमदोनों के लिए',
      en: 'for you both',
    },
    sf: {
      speakerName: 'Kaushila Birhor',
      path: 'birhor/audio/NExkGez4TRBhxuv7rMzX_1646843775362.wav',
    },
    ub: 'T4qikh1eTafizvpmHNcG29uRQ2j1',
    ii: 'v4-1646842787283',
    id: 'NExkGez4TRBhxuv7rMzX',
    nc: '6/12',
    pl: 'aben bar hoɽ kʰatu',
  },
  {
    gl: {
      or: 'Mankada',
      en: 'Rhesus monkey',
    },
    nt: 'Parlakhemundi: Animals 232 to 258 #',
    sf: {
      ts: 1580860148537,
      speakerName: 'Budura Raspeda',
      source: 'local_import',
      path: 'gta/audio/local_import/Gta-Pkd-Dec13-An-rhesus-monkey-1580860134632.mp3',
    },
    pf: {
      source: 'local_import',
      gcs: 'RFMsChWMpLTc-0Oo8srvCtHr40UTMQz-mcuqNkcVanRagRQLd_s7iZqTbTE74EHdjh1TGTjDo8YvcVkePgmN8Q',
    },
    sdn: ['1.5'],
    lx: 'geseʔ',
    sd: null,
    createdBy: 'OTD',
    xs: {
      vernacular:
        'Photo by John Connell, September 9 2007 CC BY-NC-SA 2.0 https://www.flickr.com/photos/soutra/1351155387',
    },
    id: 'cY1McfcmkJyv6EqHeynb',
  },
];

export const entriesWithSemanticDomains: IEntry[] = [
  {
    id: '1',
    lx: 'One semantic domain',
    gl: null,
    sdn: ['4'],
  },
  {
    id: '2',
    lx: 'Five semantic domains',
    gl: null,
    sdn: ['1', '1.5', '2.1', '2.2', '2.3'],
  },
  {
    id: '3',
    lx: 'Many semantic domains',
    gl: null,
    sdn: [
      '1.3',
      '1.7',
      '2.2',
      '2.6',
      '2.8',
      '3',
      '4',
      '5',
      '5.17',
      '6',
      '7',
      '8',
      '9',
      '10',
      '10.1',
      '10.3',
      '10.6',
      '10.8',
      '10.9',
    ],
  },
  {
    id: '4',
    lx: 'None semantic domains',
    gl: null,
    sdn: [],
  },
];

export const entriesWithAlternateOrthographies: IEntry[] = [
  {
    id: 'altOrth5',
    lx: 'Hello',
    gl: null,
    lo: 'Nnọọ',
    lo2: 'Привет',
    lo3: 'سلام',
    lo4: 'नमस्ते',
    lo5: 'שלום',
  },
  {
    id: 'altOrth3',
    lx: 'Bye',
    gl: null,
    lo: 'さよなら',
    lo2: '안녕',
    lo3: 'αντίο',
  },
];

export const entriesWithPhonetics: IEntry[] = [
  {
    id: 'phonetics',
    lx: 'Giraffe',
    gl: null,
    ph: 'dʒɚˈɹæf',
  },
  {
    id: 'noPhonetics',
    lx: 'Quiet',
    gl: null,
  },
];

export const entriesWithPartsOfSpeech: IEntry[] = [
  {
    id: 'PoS',
    lx: 'Parts of speech',
    gl: null,
    ps: 'np',
  },
  {
    id: 'PoSpref',
    lx: 'un-',
    gl: null,
    ps: 'pref',
  },
];

export const entriesWithGlosses: IEntry[] = [
  {
    id: 'multipleGlosses',
    lx: 'Hello World',
    gl: {
      es: 'Hola mundo',
      fr: 'Bonjour le monde',
      it: 'Ciao mondo',
      pt: 'Olá Mundo',
      de: 'Hallo Welt',
    },
  },
  {
    id: 'fewGlosses',
    lx: 'Excuse me',
    gl: { sv: 'Ursäkta mig', no: 'unnskyld meg', da: 'undskyld mig' },
  },
  {
    id: 'oneGloss',
    lx: 'Happy',
    gl: { fi: 'Onnellinen' },
  },
];

export const entriesWithExampleSentences: IEntry[] = [
  {
    id: 'multipleExampleSentences',
    lx: 'Fear',
    gl: null,
    xs: {
      es: 'Un hombre que huye de su miedo puede encontrar que solamente ha tomado un atajo para encontrarlo.',
      fr: "Un homme qui fuit sa peur peut s'apercevoir qu'il n'a pris qu'un raccourci pour y faire face.",
      it: 'Un uomo che fugge dalla sua paura può scoprire di aver preso solo una scorciatoia per affrontarla.',
      pt: 'Um homem que foge de seu medo pode descobrir que apenas tomou um atalho para enfrentá-lo.',
      de: 'Ein Mann, der vor seiner Angst flieht, kann feststellen, dass er nur eine Abkürzung genommen hat, um ihr zu begegnen.',
      vn: 'A man that flies from his fear may find that he has only taken a short cut to meet it.',
    },
  },
  {
    id: 'fewExampleSentences',
    lx: 'Life',
    gl: null,
    xs: {
      sv: 'Ditt livs form ligger i dina händer att bryta.',
      no: 'Formen i livet ditt er i dine hender for å bryte.',
      da: 'Dit livs form er i dine hænder for at bryde.',
      vn: 'The mold of your life is in your hands to break.',
    },
  },
  {
    id: 'oneExampleSentence',
    lx: 'Gratitude',
    gl: null,
    xs: {
      fi: 'todistaa, että vaikka mieli ja voima olivat menneet, kiitollisuus ja molemminpuolinen hellyys elivät edelleen ihmisten sydämessä.',
      vn: 'to witness that even when mind and strength had gone, gratitude and a mutual tenderness still lived on in the heart of men.',
    },
  },
];
