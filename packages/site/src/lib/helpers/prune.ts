export function pruneObject<T>(obj: T) {
  const prunedObject = {} as T;
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value) && value.length === 0) {
        // Skip empty arrays
      } else if (value instanceof Object && !(value instanceof Array) && key != 'coordinates') {
        prunedObject[key] = pruneObject(value);
      } else {
        prunedObject[key] = value;
      }
    }
  });
  return prunedObject;
}
