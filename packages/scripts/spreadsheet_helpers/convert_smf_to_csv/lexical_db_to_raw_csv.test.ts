import { text_to_csv_format } from './lexical_db_to_raw_csv';

describe('text_to_csv_format', () => {
  test('converts normal SMF text', () => {
    const data = [
      '\\lx hiyaènhïì\r',
      '\\ph hiZaNhi\r',
      '\\tl H [L] L\r',
      '\\b\r',
      '\\pl\r',
      '\\ps v\r',
      '\\n 1544\r',
      '\r',
      '\\ge hasten, hurry\r',
      '\\re hasten ; hurry\r',
      '\\gn se dépêcher\r',
      '\\dt 29/Aug/2005\r',
    ];
    expect(text_to_csv_format(data)).toMatchInlineSnapshot(`
      "\\\\lx,hiyaènhïì
      \\\\ph,hiZaNhi
      \\\\tl,H [L] L
      \\\\b,
      \\\\pl,
      \\\\ps,v
      \\\\n,1544

      \\\\ge,hasten, hurry
      \\\\re,hasten ; hurry
      \\\\gn,se dépêcher
      \\\\dt,29/Aug/2005
      "
    `);
  });
});
