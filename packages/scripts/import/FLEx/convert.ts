
// import torwali from './torwali-edited.json'; **Note that data files aren't in this repo**
import { abbreviateTDPartOfSpeech } from './abbreviate-pos';
import { IEntry } from '../../../../src/lib/interfaces';

// const entries = [...torwali];
const entries = [];

const data: IEntry[] = entries.map((entry) => {
  entry.lx.trim();
  delete entry.lx_Tor; // duplicate of lx
  delete entry.sn;

  if (entry.ps_Eng) {
    if (entry.ps_Eng === 'Idiom')
      entry.nt = 'idiom';
    else
      entry.ps = abbreviateTDPartOfSpeech(entry.ps_Eng);

  }
  delete entry.ps_Eng; // part of speech

  entry.gl = {};
  // English definition/gloss
  if (entry.d_Eng) {
    entry.gl.en = entry.d_Eng.trim();
    delete entry.d_Eng; // English definition/gloss
  }

  if (entry.d_Urd) {
    entry.gl.ur = entry.d_Urd.trim();
    delete entry.d_Urd; // Urdu definition/gloss
  }

  entry.xs = {};
  if (entry.xv_Eng) {
    entry.xs.en = entry.xv_Eng;
    delete entry.xv_Eng; // example English
  }
  if (entry.xv_Tor) {
    entry.xs.vn = entry.xv_Tor;
    delete entry.xv_Tor; // Example (sentence) vernacular
  }
  if (entry.xv_Urd) {
    entry.xs.ur = entry.xv_Urd;
    delete entry.xv_Urd; // Example (sentence) Urdu
  }
  if (Object.keys(entry.xs).length === 0)
    delete entry.xs;


  // leave entry.hm; // 1, 2, 3, 4, 5 (homonym)
  // leave entry.dt; // date written as 12/Jan/2020
  // leave entry.semdom & entry.sd; // semdom numbers that weren't represented in our abbreviated semantic domains list

  const semanticDomainNumbers: string[] = [];
  Object.keys(entry).forEach((key) => {
    if (/sd.+/.test(key)) {
      // sd1, sd2, etc...
      semanticDomainNumbers.push(key.replace('sd', '').replace('_', '.'));
      delete entry[key];
    }
  });
  if (semanticDomainNumbers.length)
    entry.sdn = semanticDomainNumbers;


  return entry;
});
// .filter((entry) => Object.keys(entry).length !== 0);

function download(entries: IEntry[], fileName: string, contentType: string) {
  const a = document.createElement('a');
  const file = new Blob([JSON.stringify(entries)], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}
// uncomment to download
// download(data, "torwali-converted.json", "application/json");
