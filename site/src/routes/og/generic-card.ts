import { card_key } from './card-store'

/**
 * The process's spare tyre: ONE card, rendered while nothing else is going on and
 * stored under a fixed key, so a shed request can be answered with a real Living
 * Dictionaries card at zero CPU instead of a 1×1 transparent pixel.
 *
 * Its own module so tests can seed or clear it — a background render firing at an
 * unpredictable moment otherwise makes every render-count assertion flaky.
 */
export const GENERIC_PROPS = { title: 'Living Dictionaries', description: 'Language documentation web app for communities', dictionaryName: '' }

/** Fixed key, never a request's. */
export const GENERIC_CARD_KEY = card_key({ props_param: '__generic_fallback__', image_version: null })
