export function mergeBy<T>(sourceArray: T[], updatingArray: T[], field: string) {
  const mergedArr = sourceArray;
  if (Array.isArray(updatingArray)) {
    for (const value of updatingArray.reverse()) {
      const matchedIndex = sourceArray.findIndex((x) => x[field] === value[field]);
      if (matchedIndex >= 0) {
        sourceArray[matchedIndex] = value;
      } else {
        mergedArr.unshift(value);
      }
    }
  }
  return mergedArr;
}
