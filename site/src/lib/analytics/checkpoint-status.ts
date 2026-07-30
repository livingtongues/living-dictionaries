/**
 * What the dashboards know about the daily analytics CHECKPOINT they are rendering.
 *
 * Client-safe on purpose: `CheckpointBar.svelte` and the two admin views need this
 * shape, and the module that produces it (`$lib/db/server/analytics-snapshot.ts`) has
 * a top-level child-process entry guard that must never be pulled into a client
 * bundle.
 */
export interface CheckpointStatus {
  /** When the niced child computed the payload on screen. Null = no checkpoint yet. */
  generated_at: string | null
  /** What that compute cost, so an expensive checkpoint is visible without hand-measuring. */
  computed_ms: number | null
  /** Why the child ran: `cron` | `boot-catchup` | `manual`. */
  reason: string | null
  /** A child is computing RIGHT NOW (the page says "Computing…" after a Recompute). */
  running: boolean
}
