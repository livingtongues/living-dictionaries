import { promises as fsPromises } from 'fs';

async function roll_back_env_variables() {
  try {
    await fsPromises.rename('./temp.json', './.clasp.json');
  } catch (err) {
    console.error(err);
  }
}

roll_back_env_variables();