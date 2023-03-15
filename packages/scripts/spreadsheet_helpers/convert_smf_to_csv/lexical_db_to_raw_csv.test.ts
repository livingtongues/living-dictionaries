import { lines_to_csv_format } from './lexical_db_to_raw_csv';

describe('text_to_csv_format', () => {
  test('converts normal SMF text', () => {
    const data = [
      '\\lx This is only an example of a lexeme\r',
      '\\ph\r',
      '\\xe This is only an example of an example sentence field',
    ];
    expect(lines_to_csv_format(data)).toMatchInlineSnapshot(`
      "\\\\lx,This is only an example of a lexeme
      \\\\ph,
      \\\\xe,This is only an example of an example sentence field"
    `);
  });

  test('converts SMF text with broken lines', () => {
    const data = [
      '\\xv example that continues\r',
      'in the next line.\r',
      '\\xe another example without the',
      'carriage return.',
      '\\ph\r',
    ];
    expect(lines_to_csv_format(data)).toMatchInlineSnapshot(`
      "\\\\xv,example that continues in the next line.

      \\\\xe,another example without the carriage return.

      \\\\ph,"
    `);
  });

  test('converts SMF text with broken lines and removing unecessary line breaks', () => {
    const data = [
      '\\xv example that continues\r',
      'in the next line.\r',
      '\\xe another example without the',
      'carriage return.',
      '\\ph\r',
    ];
    expect(lines_to_csv_format(data).replace(/^[\s\n]*/gm, '')).toMatchInlineSnapshot(`
      "\\\\xv,example that continues in the next line.
      \\\\xe,another example without the carriage return.
      \\\\ph,"
    `);
  });
});
