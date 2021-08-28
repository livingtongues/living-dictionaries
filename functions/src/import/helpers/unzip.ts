import * as fs from 'fs-extra';
const unzipper = require('unzipper');

const dataFileFormats = ['csv', 'json', 'xlsx'];
const imageFileFormats = ['jpg', 'jpeg', 'gif', 'png'];
const audioFileFormats = ['mp3', 'wav'];

export const unzipArchive = async (
  language: string,
  dictionaryId: string,
  type: 'old-td' | 'spreadsheet'
) => {
  let dataFileName = '';
  let audioFileCount = 0;
  let imageFileCount = 0;
  fs.mkdirSync(`dictionary/${dictionaryId}/data/`, { recursive: true });
  fs.mkdirSync(`dictionary/${dictionaryId}/audio/`, { recursive: true });
  fs.mkdirSync(`dictionary/${dictionaryId}/images/`, { recursive: true });

  return await new Promise((resolve, reject): any => {
    const filepath = `ready-data/${language}.zip`;
    fs.createReadStream(filepath)
      .pipe(unzipper.Parse())
      .on('entry', (entry: any) => {
        if (entry.path && entry.type === 'File') {
          const fileName = entry.path.split('/').pop();
          const fileExt = entry.path.split('.').pop();

          if (fileName.match(/\?/)) {
            // skip over kera_mundari missing file with ? in name
            console.log(`Skipping ${fileName} because of ? which caused it to be missing`);
            entry.autodrain();
            return;
          }

          if (fileName.match(/^\._/)) {
            // skip Mac metadata files
            entry.autodrain();
            return;
          }

          if (dataFileFormats.includes(fileExt.toLowerCase())) {
            dataFileName = fileName;
            entry.pipe(fs.createWriteStream(`dictionary/${dictionaryId}/data/${fileName}`));
          } else if (audioFileFormats.includes(fileExt.toLowerCase())) {
            ++audioFileCount;
            entry.pipe(fs.createWriteStream(`dictionary/${dictionaryId}/audio/${fileName}`));
          } else if (imageFileFormats.includes(fileExt.toLowerCase())) {
            ++imageFileCount;
            entry.pipe(fs.createWriteStream(`dictionary/${dictionaryId}/images/${fileName}`));
          } else {
            console.log('No proper file type found for: ', fileName, ' - autodraining');
            entry.autodrain();
          }
        } else {
          entry.autodrain();
        }
      })
      .promise()
      .then(
        () => {
          console.log(
            { audioFileCount },
            { imageFileCount },
            `<< number of files found in zip archive`
          );
          resolve(dataFileName);
        },
        (e: Error) => reject(e)
      );
  });
};
