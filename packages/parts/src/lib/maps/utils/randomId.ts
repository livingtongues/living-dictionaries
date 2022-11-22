export const ADDED_FEATURE_ID_PREFIX = '_customFeature_';

/**
 * Math.random should be unique because of its seeding algorithm. Convert it to base 36 (numbers + letters), and grab the first 9 characters after the decimal.
 */
export function randomId(): string {
  return ADDED_FEATURE_ID_PREFIX + Math.random().toString(36).slice(2, 11);
}
