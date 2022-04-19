#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as args from 'commander';

args.version('0.0.1').option('-s, --src <path>', 'Source file path').parse(process.argv);

async function gatherPartsOfSpeech() {
  const file = args.src;
  let data;
  if (file.includes('.json')) {
    data = await fs.readJSON(file);
  } else {
    return console.log('JSON file not found');
  }

  const partsOfSpeech = [];
  for (let i = 0; i < data.length; i++) {
    const pos = data[i].pos;

    if (partsOfSpeech.indexOf(pos) === -1) partsOfSpeech.push(pos);
  }

  fs.writeFile('GatheredPOS.json', JSON.stringify(partsOfSpeech), function (err) {
    if (err) {
      return console.log(err);
    }
    console.log('Parts of Speech saved to GatheredPOS.json');
  });
  console.log(partsOfSpeech);
}

gatherPartsOfSpeech();
