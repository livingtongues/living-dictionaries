import { promises as fsPromises } from 'fs';

async function read_env_variables(variables_file, clasp_file) {
  try {
    const variables = await fsPromises.readFile(variables_file, 'utf-8');
    const clasp_content = await fsPromises.readFile(clasp_file, 'utf-8');
    const match_script = variables.match(/SCRIPT_ID=(.+)/);
    const script_id = match_script ? match_script[1] : null;
    const match_root_dir = variables.match(/ROOT_DIRECTORY=(.+)/);
    const root_dir = match_root_dir ? match_root_dir[1] : null; 

    if (!script_id) {
      console.error('SCRIPT_ID not found in .env.local');
      return;
    }
    if (!root_dir) {
      console.error('ROOT_DIRECTORY not found in .env.local');
      return;
    }
    await fsPromises.writeFile('./temp.json', clasp_content);
    const updatedContent = clasp_content.replace(/SCRIPT_ID|ROOT_DIRECTORY/g, match => {
      return match === "SCRIPT_ID" ? script_id : root_dir;
    });
    
    await fsPromises.writeFile(clasp_file, updatedContent);
  } catch (err) {
    console.error(err);
  }
}

read_env_variables('./.env.local', './.clasp.json');
