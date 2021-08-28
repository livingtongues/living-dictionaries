export function filterEntries(entries, filterString, filterField) {
  if (filterField) {
    return entries.filter((entry) => {
      if (entry[filterField]) {
        if (filterString) {
          const fieldString = JSON.stringify(entry[filterField]);
          return fieldString.toLowerCase().includes(filterString.toLowerCase());
        } else {
          return true;
        }
      } else {
        return false;
      }
    });
  }

  if (filterString) {
    return entries.filter((entry) => {
      const entryString = JSON.stringify(entry);
      return entryString.toLowerCase().includes(filterString.toLowerCase());
    });
  }

  return entries;
}
