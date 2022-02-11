export function pruneObject<T>(obj: T) {
  const prunedObject = {} as T;
  Object.keys(obj).forEach((key) => {
    if (obj[key] != null && obj[key] != '' && obj[key] != []) {
      if (obj[key] instanceof Object && !(obj[key] instanceof Array)) {
        prunedObject[key] = pruneObject(obj[key]);
      } else {
        prunedObject[key] = obj[key];
      }
    }
  });
  return prunedObject;
}
