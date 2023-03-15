import { writeFile, readFile } from 'fs';
const relative_path = 'spreadsheet_helpers/convert_smf_to_csv/';

export function convert_db_to_raw_csv(input: string, output: string) {
  readFile(`${relative_path}${input}`, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
    }
    const csv_text = lines_to_csv_format(data.trim().split('\n')).replace(/^[\s\n]*/gm, '');

    writeFile(`${relative_path}${output}`, csv_text, (err) => {
      if (err) {
        console.error(err);
      }
      console.log(`File ${output} created successfully.`);
    });
  });
}

export function lines_to_csv_format(lines: string[]): string {
  const rows = lines.map((line, index) => {
    const add_comma_after_first_field = line.includes(' ')
      ? line.replace(/ /, ',')
      : line.replace(/\r/, ',');
    let csv_line;
    if (index < lines.length - 1 && !lines[index + 1].startsWith('\\')) {
      csv_line = add_comma_after_first_field.replace(/\r/, '');
      csv_line += ' ' + lines[index + 1];
    } else if (line.startsWith('\\')) {
      csv_line = add_comma_after_first_field;
    }
    return csv_line;
  });

  return rows.join('\n');
}

convert_db_to_raw_csv('example_file.db', 'result.csv');
