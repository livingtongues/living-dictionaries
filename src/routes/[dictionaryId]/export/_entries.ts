import JSZip from 'jszip';
import { downloadObjectAsCSV, fileAsBlob } from '$lib/export/csv';
import { getCollection } from '$sveltefire/firestore';

import type { IEntry } from '$lib/interfaces';
import { glossingLanguages } from './_glossing-languages-temp';
import { semanticDomains } from '$lib/mappings/semantic-domains';
import { partsOfSpeech } from '$lib/mappings/parts-of-speech';
import { firebaseConfig } from '$sveltefire/config';
import { fetchSpeakers } from '$lib/helpers/fetchSpeakers';

async function downloadMedia(mediaURLs: string[]) {
  //Zip and downloading images
  const blobMedia = [];
  await Promise.all(
    mediaURLs.map(async (url) => {
      try {
        const fetchedMedia = await fetch(url);
        const blobs = await fetchedMedia.blob();
        blobMedia.push(blobs);
      } catch {
        //TODO I don't know what to do here!
        console.log('Something is wrong!');
      }
    })
  );
  return blobMedia;
}

async function zipper(
  dictionaryName: string,
  audioNames: string[],
  imageNames: string[],
  CSVFile: Blob,
  blobAudios: Blob[],
  blobImages: Blob[]
) {
  if (blobAudios.length > 0 || blobImages.length > 0) {
    const zip = new JSZip();
    CSVFile ? zip.file(`${dictionaryName}.csv`, CSVFile) : '';
    blobImages.forEach((bi, i) => {
      zip.folder(`${dictionaryName}_Images/`).file(`${imageNames[i]}`, bi, { binary: true });
    });
    blobAudios.forEach((ba, i) => {
      zip.folder(`${dictionaryName}_Audio/`).file(`${audioNames[i]}`, ba, { binary: true });
    });

    const { saveAs } = await import('file-saver');
    await zip.generateAsync({ type: 'blob' }).then((blob) => {
      saveAs(blob, `${dictionaryName}.zip`);
    });
  }
}

function valuesInColumn(itemsFormatted, i, values, columnName, fn) {
  if (values) {
    let stringValue = '';
    //In case some strings contain commas
    const list = values.map(fn);
    stringValue += list.map((el) => el.replace(/,/g, ' -'));
    stringValue = stringValue.replace(/,/g, ' | ');
    Object.assign(itemsFormatted[i], JSON.parse(`{"${columnName}": "${stringValue}"}`));
  } else {
    Object.assign(itemsFormatted[i], JSON.parse(`{ "${columnName}": "" }`));
  }
}

export async function exportEntriesAsCSV(
  data: IEntry[],
  title: string,
  glosses: string[],
  includeAudios = false,
  includeImages = false
) {
  //Getting the total number of semantic domains by entry if they have at least one
  let totalSDN = 0;
  const filterSDN = data.filter((entry) => (entry.sdn ? entry.sdn.length : ''));
  if (filterSDN.length > 0) {
    totalSDN = filterSDN
      .map((entry) => entry.sdn.length)
      .reduce((maxLength, sdnLength) => Math.max(maxLength, sdnLength));
  }
  const replacementChars = {
    ',': ' -',
    '"': "'",
  };
  const speakers = await fetchSpeakers(data);
  const imageNames = [];
  const imageUrls = [];
  const audioNames = [];
  const audioUrls = [];
  const headers = {
    id: 'Entry id',
    lx: 'Lexeme/Word/Phrase',
    ph: 'Phonetic (IPA)',
    in: 'Interlinearization',
    mr: 'Morphology',
    di: 'Dialect for this entry',
    nt: 'Notes',
    psab: 'Parts of speech abbreviation',
    ps: 'Parts of speech',
    sr: 'Source(s)',
  };
  //Assigning semantic domains as headers
  if (totalSDN > 0) {
    for (let index = 0; index < totalSDN; index++) {
      Object.assign(headers, JSON.parse(`{"sd${index + 1}": "Semantic domain ${index + 1}"}`));
    }
  }
  //Assigning glosses as headers
  glosses.forEach((bcp) => {
    Object.assign(headers, JSON.parse(`{ "gl${bcp}": "${glossingLanguages[bcp]} Gloss" }`));
  });
  //Assigning example sentences as headers
  for (let j = 0; j <= glosses.length; j++) {
    if (j === glosses.length) {
      Object.assign(headers, JSON.parse(`{"xsvn": "Example sentence in ${title}"}`));
    } else {
      Object.assign(
        headers,
        JSON.parse(`{"xs${glosses[j]}": "Example sentence in ${glossingLanguages[glosses[j]]}"}`)
      );
    }
  }
  //Assigning audio metadata as headers
  Object.assign(headers, {
    aupa: 'Audio path',
    ausn: 'Speaker name',
    aubp: 'Speaker birthplace',
    aude: 'Speaker decade',
    auge: 'Speaker gender',
  });

  //Assigning images metadata as headers
  Object.assign(headers, {
    impa: 'Image path',
  });

  const itemsFormatted = [];
  data.forEach((entry, i) => {
    //Avoiding showing null values
    const entryKeys = Object.keys(entry);
    entryKeys.forEach((key) => (!entry[key] ? (entry[key] = '') : entry[key]));
    itemsFormatted.push({
      id: entry.id,
      lx: entry.lx.replace(/[,"]/g, (m) => replacementChars[m]),
      ph: entry.ph,
      in: entry.in ? entry.in.replace(/[,"]/g, (m) => replacementChars[m]) : '',
      mr: entry.mr,
      di: entry.di ? entry.di.replace(/[,"]/g, (m) => replacementChars[m]) : '',
      nt: entry.nt ? entry.nt.replace(/[,"]/g, (m) => replacementChars[m]) : '',
      //xv: entry.xv,
    });
    //Assigning parts of speech (abbreviation & name)
    Object.assign(
      itemsFormatted[i],
      JSON.parse(`{
      "psab": "${entry.ps ? entry.ps : ''}"
    }`)
    );
    if (entry.ps) {
      const pos = partsOfSpeech.find((ps) => ps.enAbbrev === entry.ps)?.enName;
      Object.assign(
        itemsFormatted[i],
        JSON.parse(`{
        "ps": "${pos}"
      }`)
      );
    } else {
      Object.assign(
        itemsFormatted[i],
        JSON.parse(`{
        "ps": ""
      }`)
      );
    }
    //Assigning sources
    valuesInColumn(itemsFormatted, i, entry.sr, 'sr', (el) => el);
    //Assigning semantic domains
    if (entry.sdn) {
      for (let index = 0; index < totalSDN; index++) {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(
            `{"sd${index + 1}": "${
              entry.sdn[index]
                ? semanticDomains
                    .find((sd) => sd.key === entry.sdn[index])
                    .name.replace(/[,"]/g, (m) => replacementChars[m])
                : ''
            }"}`
          )
        );
      }
    } else {
      for (let index = 0; index < totalSDN; index++) {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
            "sd${index + 1}": ""
          }`)
        );
      }
    }
    //Assigning glosses
    //TODO Gta? is still having problems. There's another character I need to avoid
    glosses.forEach((bcp) => {
      const cleanEntry = entry.gl[bcp]
        ? entry.gl[bcp].replace(/[,"]/g, (m) => replacementChars[m])
        : '';
      Object.assign(itemsFormatted[i], JSON.parse(`{"gl${bcp}": "${cleanEntry}"}`));
    });
    //Assigning example sentences
    for (let j = 0; j <= glosses.length; j++) {
      if (entry.xs) {
        if (j === glosses.length) {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
              "xs${glosses[j] ? glosses[j] : 'vn'}": "${
              entry.xs['vn'] ? entry.xs['vn'].replace(/[,"]/g, (m) => replacementChars[m]) : ''
            }"
            }`)
          );
        } else {
          Object.assign(
            itemsFormatted[i],
            JSON.parse(`{
              "xs${glosses[j] ? glosses[j] : 'vn'}": "${
              entry.xs[glosses[j]] ? entry.xs[glosses[j]] : ''
            }"
            }`)
          );
        }
      } else {
        Object.assign(
          itemsFormatted[i],
          JSON.parse(`{
            "xs${glosses[j] ? glosses[j] : 'vn'}": ""
          }`)
        );
      }
    }
    //Audio metadata
    if (entry.sf) {
      const speaker = speakers.find((speaker) => speaker?.id === entry.sf.sp);
      const path = entry.sf.path || '';
      let speakerName = speaker?.displayName || entry.sf.speakerName || '';
      speakerName = speakerName.replace(/[,"]/g, (m) => replacementChars[m]);
      let speakerBP = speaker?.birthplace || '';
      speakerBP = speakerBP.replace(/[,"]/g, (m) => replacementChars[m]);
      const speakerDecade = speaker?.decade || '';
      const speakerGender = speaker?.gender || '';
      Object.assign(
        itemsFormatted[i],
        JSON.parse(`{
        "aupa": "${path}",
        "ausn": "${speakerName}",
        "aubp": "${speakerBP}",
        "aude": "${speakerDecade}",
        "auge": "${speakerGender}"
      }`)
      );
      audioNames.push(entry.sf.path.substring(entry.sf.path.lastIndexOf('/') + 1));
      const convertedAudioPath = entry.sf.path.replace(/\//g, '%2F');
      audioUrls.push(
        `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedAudioPath}?alt=media`
      );
    } else {
      Object.assign(itemsFormatted[i], { aupa: '', ausn: '', aubp: '', aude: '', auge: '' });
    }

    if (entry.pf) {
      Object.assign(
        itemsFormatted[i],
        JSON.parse(`{
        "impa": "${entry.pf.path}"
      }`)
      );
      imageNames.push(entry.pf.path.substring(entry.pf.path.lastIndexOf('/') + 1));
      const convertedImagesPath = entry.pf.path.replace(/\//g, '%2F');
      imageUrls.push(
        `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedImagesPath}?alt=media`
      );
    } else {
      Object.assign(itemsFormatted[i], { impa: '' });
    }
    i++;
  });
  itemsFormatted.unshift(headers);
  const CSVBlob = fileAsBlob(itemsFormatted);

  if (includeImages && includeAudios) {
    const imagesURLs = await downloadMedia(imageUrls);
    const audiosURLs = await downloadMedia(audioUrls);
    await zipper(title, audioNames, imageNames, CSVBlob, audiosURLs, imagesURLs);
  } else if (includeAudios) {
    const audiosURLs = await downloadMedia(audioUrls);
    await zipper(title, audioNames, imageNames, CSVBlob, audiosURLs, []);
  } else if (includeImages) {
    const imagesURLs = await downloadMedia(imageUrls);
    await zipper(title, audioNames, imageNames, CSVBlob, [], imagesURLs);
  } else {
    downloadObjectAsCSV(itemsFormatted, title);
  }
}

export async function downloadEntries(
  id: string,
  name: string,
  glosses: string[],
  includeAudios = false,
  includeImages = false
) {
  const dataEntries = await getCollection<IEntry>(`dictionaries/${id}/words`);
  if (includeImages && includeAudios) {
    await exportEntriesAsCSV(dataEntries, name, glosses, true, true);
  } else if (includeAudios) {
    await exportEntriesAsCSV(dataEntries, name, glosses, true);
  } else if (includeImages) {
    await exportEntriesAsCSV(dataEntries, name, glosses, false, true);
  } else {
    await exportEntriesAsCSV(dataEntries, name, glosses);
  }
}
