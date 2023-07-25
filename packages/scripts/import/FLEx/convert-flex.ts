// import { data } from "./Babanki-Kejom";

import type { IEntry } from '../../../../src/lib/interfaces';

interface IFLExData {
  lx: string;
  lx_Bab: string; // ignore as only 8 entries have a different lx_Bab than lx and these only leave off the suffix or prefix dash
  d_Eng?: string; // english gloss
  co_Eng?: string; // notes or definition clarification
  ps_Eng?: string; // converted - unmatch parts left as is

  // All the variants are dialectal: Kejom Keku, Kejom Ketinguh
  lf?: string; // 'cf' for compare with
  lv?: string; // word to compare with
  va?: string; // variant
  mn?: string; // main entry form (used in homonyms)
  hm?: string; // 1,2,3,4,5

  z0?: string; // 'added', 'gradually', 'new' or sequence of 4 numbers like 1655 (ignoring)

  z1?: string; // plural
  z2?: string; // 6, 9 , 1/2 noun class numbers (singular/plural), 10 is suffixal
}

export function convertFLExToLDFormat(data: IFLExData[]) {
  const entries: IEntry[] = [];
  // const check = new Set();

  data.map((e) => {
    const entry: IEntry = {
      lx: e.lx.trim(),
      gl: {
        en: e.d_Eng || null,
      },
    };

    // check.add(e.z1);

    if (e.co_Eng)
      entry.nt = e.co_Eng;

    if (e.ps_Eng)
      entry.ps = matchPartsOfSpeech(e.ps_Eng);

    entries.push(entry);
  });
  // console.log(check);
  return entries;
}

function matchPartsOfSpeech(input: string): string {
  const mapping = {
    prep: 'prep',
    Adverb: 'adv',
    interrog: 'q',
    Noun: 'n',
    num: 'no',
    Verb: 'v',
    conj: 'conj',
    // 'con', // TODO: concord, put into nt field
    // 'am', // asssociative marker (genitive)
    'pro indef': 'indfpro',
    // 'pro subj', // ? pronoun or subjunctive
    // 'pro obj', // ? pronoun or object
    // 'pro demons', // ? mark as pronoun or demonstrative
    adj: 'adj',
    tm: 'tns',
    'pro poss': 'poss',
    neg: 'neg',
    Pronoun: 'pro',
  };
  //@ts-ignore
  return mapping[input] || input;
}
