/**
 * Ask the browser to mark our origin's storage **persistent** so it won't EVICT
 * the local DB (OPFS or IndexedDB) under storage pressure. Without this the
 * browser may silently clear it — including unsynced local writes (see the
 * local-first landscape knowledge page; Logseq guards this the same way).
 *
 * Persistence is ORIGIN-scoped, so one successful request covers every DB on the
 * origin. Call it from the main thread (NOT a worker) — `persist()` can surface
 * UI — and only once per privileged context.
 *
 * Prompt behaviour differs by browser:
 *   - Chromium / Safari: NEVER prompts — granted or denied by heuristics.
 *   - Firefox: shows a one-time permission doorhanger when `persist()` is called.
 *
 * `allow_prompt` gates who may RISK the Firefox prompt:
 *   - a privileged role with precious unsynced local writes (admin / editor) →
 *     pass `true` to request it (a one-time Firefox prompt is acceptable).
 *   - an anonymous / read-only role whose data is cheaply re-fetchable → pass
 *     `false` for the silent path only: report `persisted()`, and upgrade via
 *     `persist()` solely when the permission is ALREADY granted (never prompts).
 *
 * This file is app-agnostic — keep it byte-identical across house / LD / tutor.
 */
export async function ensure_persistent_storage({ allow_prompt }: { allow_prompt: boolean }): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist || !navigator.storage.persisted)
      return false

    if (await navigator.storage.persisted())
      return true

    if (!allow_prompt) {
      // Silent path: only call persist() when the permission is already granted,
      // so a reader never sees the Firefox doorhanger.
      let granted = false
      try {
        const status = await navigator.permissions?.query({ name: 'persistent-storage' as PermissionName })
        granted = status?.state === 'granted'
      } catch {
        // Permissions API / the 'persistent-storage' name is unsupported (e.g.
        // Safari) → stay silent rather than risk a prompt.
      }
      if (!granted)
        return false
    }

    return await navigator.storage.persist()
  } catch {
    return false
  }
}
