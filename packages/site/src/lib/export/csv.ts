import { downloadBlob } from "./downloadBlob";

export function downloadObjectsAsCSV(headers: Record<string, any>, items: Record<string, any>[], title: string) {
  const csv = objectsToCsvByHeaders(headers, items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, title, '.csv');
}

export function objectsToCsvByHeaders(headers: Record<string, any>, items: Record<string, any>[]): string {
  const headerRow = Object.values(headers).map(turnValueIntoStringSurroundWithQuotesAsNeeded).join(',');
  
  const headerKeys = Object.keys(headers);
  const itemRows = items
    .map((row) => {
      return headerKeys.map((key) => turnValueIntoStringSurroundWithQuotesAsNeeded(row[key])).join(',');
    })

  return [headerRow, ...itemRows].join('\n');
}

function turnValueIntoStringSurroundWithQuotesAsNeeded(value: any) {
  if (value === null || value === undefined) return '';
  if (isNaN(value) && (value.includes(',') || value.includes('"')))
    return `"${value.replace(/"/g, '""')}"`;
  return value;
}

if (import.meta.vitest) {
  describe('objectsToCsvByHeaders', () => {
    const headers = {
      name: 'Name',
      age: 'Age',
      city: 'City',
    };

    test('converts objects to CSV format', () => {
      const items = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Bob', age: 40, city: 'Chicago' },
      ];
      const result = objectsToCsvByHeaders(headers, items);
      expect(result).toMatchInlineSnapshot(`
        "Name,Age,City
        John,30,New York
        Jane,25,Los Angeles
        Bob,40,Chicago"
      `);
    });

    test('handles null, undefined, out of order, and missing values', () => {
      const items = [
        { name: 'John', age: null, city: 'New York' },
        { name: 'Jane', city: 'Los Angeles', age: undefined },
        { name: 'Bob', city: 'Chicago' },
      ];
      const result = objectsToCsvByHeaders(headers, items);
      expect(result).toMatchInlineSnapshot(`
        "Name,Age,City
        John,,New York
        Jane,,Los Angeles
        Bob,,Chicago"
      `);
    });

    test('handles values with commas and quotes', () => {
      const items = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles, CA' },
        { name: 'Bob', age: 40, city: 'Chicago "Windy City"' },
      ];
      const result = objectsToCsvByHeaders(headers, items);
      const expectedCsv = `Name,Age,City\nJohn,30,New York\nJane,25,"Los Angeles, CA"\nBob,40,"Chicago ""Windy City"""`;
      expect(result).toEqual(expectedCsv);
    });

    test('handles boolean', () => {
      const headers = {
        city: 'City',
        windy: 'Windy',
      };
      const items = [ { city: 'Chicago', windy: true } ];
      const result = objectsToCsvByHeaders(headers, items);
      const expectedCsv = `City,Windy\nChicago,true`;
      expect(result).toEqual(expectedCsv);
    });

    test('also handles abnormal header values', () => {
      const headers = {
        number: 1,
        boolean: true,
        hasComma: 'City, State',
        hasQuote: 'The "Expression"',
      };
      const items = [];
      const result = objectsToCsvByHeaders(headers, items);
      const expectedCsv = `1,true,"City, State","The ""Expression"""`;
      expect(result).toEqual(expectedCsv);
    });
  });
}
