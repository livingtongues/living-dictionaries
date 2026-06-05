import PostalMime from 'postal-mime'
import { build_inbound_payload } from './build-inbound-payload'
import type { Env } from './types'

/**
 * Cloudflare Email Routing handler. Receives an inbound email, parses MIME,
 * uploads each attachment directly to R2 (via the `ATTACHMENTS` binding),
 * then POSTs metadata-only JSON to the VPS. Attachment bytes never touch
 * the VPS for inbound — bandwidth + CPU savings, plus the VPS can be down
 * and attachments still land in R2 for later reconciliation.
 *
 * Catch-all routing: ANY `*@livingdictionaries.app` address lands here once
 * the Email Routing catch-all is flipped from forward → worker. The VPS-side
 * endpoint captures `to_email` so admins see which alias was emailed.
 *
 * Failures throw from the `ctx.waitUntil` chain so Cloudflare logs the error
 * and Email Routing surfaces the failure to the sender (rather than silently
 * dropping). We DO NOT call `message.setReject` — let CF Email Routing
 * handle bounce-vs-retry semantics per its configured behavior.
 */
export default {
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer()
    const parsed = await new PostalMime().parse(raw)

    const { payload, uploads } = build_inbound_payload({
      parsed,
      envelope_from: message.from,
      envelope_to: message.to,
      received_at: new Date().toISOString(),
      generate_id: () => crypto.randomUUID(),
    })

    ctx.waitUntil((async () => {
      // Upload every attachment to R2 in parallel — failure throws + CF retries.
      await Promise.all(uploads.map(({ key, bytes, mimetype }) =>
        env.ATTACHMENTS.put(key, bytes, {
          httpMetadata: { contentType: mimetype },
        }),
      ))

      const response = await fetch(`${env.LD_VPS_URL}/api/messages/email-inbound`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-secret': env.INTERNAL_INGEST_SECRET,
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '<no body>')
        throw new Error(
          `VPS rejected inbound email: ${response.status} ${response.statusText} — ${text}`,
        )
      }
    })())
  },
}
