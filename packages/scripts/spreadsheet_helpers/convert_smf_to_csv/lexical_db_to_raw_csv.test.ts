import { lines_to_csv_format } from './lexical_db_to_raw_csv';

describe('text_to_csv_format', () => {
  test('converts normal SMF text', () => {
    const data = [
      '\\lx hiyaènhïì\r',
      '\\ph hiZaNhi\r',
      '\\tl H [L] L\r',
      '\r',
      '\\ge hasten, hurry\r',
      '\\re hasten ; hurry\r',
      '\\gn se dépêcher\r',
      '\\dt 29/Aug/2005\r',
      '\\de esto solo es una oración',
      'cortada de ejemplo',
      '\\b\r',
      '\\pl\r',
      '\\ps v\r',
      '\\n 1544\r',
    ];
    expect(lines_to_csv_format(data).replace(/^[\s\n]*/gm, '')).toMatchInlineSnapshot(`
      "\\\\lx,hiyaènhïì
      \\\\ph,hiZaNhi
      \\\\tl,H [L] L
      \\\\ge,hasten, hurry
      \\\\re,hasten ; hurry
      \\\\gn,se dépêcher
      \\\\dt,29/Aug/2005
      \\\\de,esto solo es una oración cortada de ejemplo
      \\\\b,
      \\\\pl,
      \\\\ps,v
      \\\\n,1544
      "
    `);
  });
});
