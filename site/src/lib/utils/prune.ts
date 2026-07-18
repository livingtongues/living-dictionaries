export function prune_object<T>(obj: T) {
  const pruned_object = {} as T
  Object.keys(obj).forEach((key) => {
    const value = obj[key]
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value) && value.length === 0) {
        // Skip empty arrays
      } else if (value instanceof Object && !(Array.isArray(value)) && key !== 'coordinates') {
        pruned_object[key] = prune_object(value)
      } else {
        pruned_object[key] = value
      }
    }
  })
  return pruned_object
}
