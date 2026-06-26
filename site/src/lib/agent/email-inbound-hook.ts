/**
 * Inbound-email agent hook. Called (fire-and-forget) after every inbound email
 * is committed to the DB. Kicks off the stateless, toolless Grok triage
 * pipeline (`lib/agent/triage/*`): assemble read-only context → classify →
 * server-apply (auto-assign / resolve-spam / targeted ping). Tracked in
 * `.issues/ai-triage-pipeline.md`.
 *
 * Non-blocking by design — we don't await the pipeline so the inbound HTTP
 * response to the CF Worker isn't held up, and `run_triage` swallows its own
 * errors so triage can never break ingest.
 */
import { run_triage } from './triage/run-triage'

export interface AgentInboundEvent {
  thread_id: string
  message_id: string
  is_new_thread: boolean
  from_email: string
  /** The `*@livingdictionaries.app` alias an emailed-in message hit; null for contact-form submissions. */
  to_email: string | null
  subject: string
}

export function fire_agent_email_inbound(event: AgentInboundEvent): void {
  console.info('[agent_email_inbound]', JSON.stringify({
    thread_id: event.thread_id,
    message_id: event.message_id,
    is_new_thread: event.is_new_thread,
    from_email: event.from_email,
    to_email: event.to_email,
    subject_preview: event.subject.slice(0, 80),
  }))
  void run_triage({ thread_id: event.thread_id })
}
