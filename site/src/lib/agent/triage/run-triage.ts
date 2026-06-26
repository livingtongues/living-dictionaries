import type { TriageClient } from './classify'
import { env } from '$env/dynamic/private'
import { is_internal_email } from '$lib/admins'
import { get_shared_db } from '$lib/db/server/shared-db'
import { apply_triage } from './apply-triage'
import { build_triage_context } from './build-context'
import { grok_triage_client, normalize_result } from './classify'

/**
 * Orchestrates one inbound-thread triage: assemble read-only context → toolless
 * Grok classification → server-applied actions. Fire-and-forget from the inbound
 * hook; never throws to the caller (logs + swallows) so triage can never break
 * email ingest.
 *
 * Standby-guarded: only the active container classifies (mirrors the crons), so
 * the two blue/green containers don't double-classify. Env-gated on XAI_API_KEY
 * → fully inert until the key is set.
 */
export async function run_triage({ thread_id, client = grok_triage_client }: {
  thread_id: string
  client?: TriageClient
}): Promise<void> {
  if (env.IS_STANDBY === 'true')
    return
  if (!env.XAI_API_KEY) {
    console.warn('[triage] XAI_API_KEY not configured — skipping triage')
    return
  }
  try {
    const db = get_shared_db()
    const ctx = build_triage_context({ db, thread_id })
    if (!ctx) {
      console.warn(`[triage] thread ${thread_id} not found — skipping`)
      return
    }
    // Mail from US (our own `@livingdictionaries.app` domain or an admin's
    // address) is never triaged — e.g. sign-in codes from
    // `no-reply@livingdictionaries.app` that loop back into the inbox. Leave the
    // thread untouched (no verdict, no spam, no ping).
    if (is_internal_email(ctx.from_email)) {
      console.info('[triage] internal sender — skipping', JSON.stringify({ thread_id, from_email: ctx.from_email }))
      return
    }
    const result = normalize_result(await client.classify(ctx))
    const decision = apply_triage({ db, thread_id, result })
    console.info('[triage] classified', JSON.stringify({
      thread_id,
      client: client.id,
      verdict: result.verdict,
      category: result.category,
      confidence: result.confidence,
      action: decision.action,
      assigned_to: decision.assignee?.name ?? null,
    }))
  } catch (err) {
    console.error(`[triage] failed for thread ${thread_id}:`, (err as Error).message)
  }
}
