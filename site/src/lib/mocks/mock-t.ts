import { en } from '$lib/i18n'
import { interpolate } from '$lib/i18n/interpolate'

/**
 * Synchronous English `t` for svelte-look stories. The real translator
 * (`getTranslator`) is async, but stories need a plain value in `page_data`.
 * Mirrors the real `splitByFirstPeriod` (split on the FIRST period) so keys like
 * `ps.pr.n` resolve correctly, and interpolates `{placeholder}` values. Falls
 * back to the key itself when missing.
 */
export function mock_t(
  key_or_options: string | { dynamicKey?: string, fallback?: string, values?: Record<string, string> },
  options?: { fallback?: string, values?: Record<string, string> },
): string {
  const key = typeof key_or_options === 'string' ? key_or_options : (key_or_options.dynamicKey ?? '')
  const opts = typeof key_or_options === 'string' ? options : key_or_options
  const fallback = opts?.fallback ?? key
  const period = key.indexOf('.')
  if (period === -1)
    return fallback
  const section = key.slice(0, period)
  const item = key.slice(period + 1)
  const result = en[section]?.[item]
  return result ? interpolate(result, opts?.values) : fallback
}
