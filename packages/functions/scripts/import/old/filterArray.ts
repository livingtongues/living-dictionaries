// #!/usr/bin/env node

import * as fs from 'fs-extra';
import * as args from 'commander';

args
  .version('0.0.1')
  .option('-d, --data <path>', 'Source file path')
  .option('-f --filter <term>', 'Search term to filter by')
  .parse(process.argv);

async function filterArray() {
  const file = args.data;
  const data = await fs.readJSON(file);

  console.log(filterByValue(data, args.filter));
}

function filterByValue(array, string) {
  return array.filter((o) =>
    Object.keys(o).some((k) => o[k].toLowerCase().includes(string.toLowerCase()))
  );
}

filterArray();
