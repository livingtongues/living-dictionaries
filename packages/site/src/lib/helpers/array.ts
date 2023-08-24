export function mergeBy<T>(sourceArray: T[], updatingArray: T[], field: string) {
  const mergedArr = sourceArray;
  if (Array.isArray(updatingArray)) {
    for (const value of updatingArray.reverse()) {
      const matchedIndex = sourceArray.findIndex((x) => x[field] === value[field]);
      if (matchedIndex >= 0)
        sourceArray[matchedIndex] = value;
      else
        mergedArr.unshift(value);

    }
  }
  return mergedArr;
}

if (import.meta.vitest) {
  describe('mergeBy', () => {
    test('should merge arrays with matching objects and place unmatched from updatingArray at the start of the array', () => {
      const sourceArray = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      const updatingArray = [
        { id: 1, name: 'Johnny' },
        { id: 3, name: 'Jake' },
      ];
      const result = mergeBy(sourceArray, updatingArray, 'id');
      expect(result).toEqual([
        { id: 3, name: 'Jake' },
        { id: 1, name: 'Johnny' },
        { id: 2, name: 'Jane' },
      ]);
    });

    test('should return the original array if updatingArray is not an array', () => {
      const sourceArray = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      const updatingArray = null;
      const result = mergeBy(sourceArray, updatingArray, 'id');
      expect(result).toEqual(sourceArray);
    });

    test('should return an empty array if both arrays are empty', () => {
      const sourceArray: any[] = [];
      const updatingArray: any[] = [];
      const result = mergeBy(sourceArray, updatingArray, 'id');
      expect(result).toEqual([]);
    });

    test('should return the updatingArray if sourceArray is empty', () => {
      const sourceArray: any[] = [];
      const updatingArray = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      const result = mergeBy(sourceArray, updatingArray, 'id');
      expect(result).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ]);
    });
  });
}
