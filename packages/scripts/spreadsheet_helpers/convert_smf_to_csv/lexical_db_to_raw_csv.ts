import { writeFile, readFile } from 'fs';
const relative_path = 'spreadsheet_helpers/convert_smf_to_csv/';

export function convert_db_to_raw_csv(input: string, output: string) {
  readFile(`${relative_path}${input}`, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
    }
    console.log(data.trim().split('\n'));
    const csv_text = text_to_csv_format(data.trim().split('\n'));

    writeFile(`${relative_path}${output}`, csv_text, (err) => {
      if (err) {
        console.error(err);
      }
      console.log(`File ${output} created successfully.`);
    });
  });
}

export function text_to_csv_format(lines: string[]): string {
  const rows = lines.map((line) => {
    let csv_line;
    if (line.startsWith('\\')) {
      csv_line = line.includes(' ') ? line.replace(/ /, ',') : line.replace(/\r/, ',');
    }
    return csv_line;
  });

  return rows.join('\n');
}

convert_db_to_raw_csv('example_file.db', 'result.csv');
