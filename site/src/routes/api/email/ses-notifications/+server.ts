import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { ResponseCodes } from '$lib/constants'
import { log_server_event } from '$lib/server/log-server-event'

/**
 * Inbound webhook for SES feedback (bounce/complaint/reject/rendering-failure/
 * delivery-delay) delivered via SNS from the `ld` configuration set (the
 * default config set on the `livingdictionaries.app` SES identity). PUBLIC
 * (SNS can't send our auth) — but pinned to our topic when `SES_SNS_TOPIC_ARN`
 * is set, so a stranger can't POST fake events.
 *
 * LD only sends transactional mail (OTP codes, admin messages), so there is no
 * suppression machinery here — feedback is recorded as server telemetry
 * (`source = 'server'`, message `ses_feedback`) where the log reviews and
 * check-logs queries surface it (e.g. a user's typo'd OTP address bouncing).
 */
interface SnsEnvelope {
  Type?: string
  TopicArn?: string
  SubscribeURL?: string
  Message?: string
}

interface SesEvent {
  eventType?: string
  notificationType?: string
  mail?: { messageId?: string, destination?: string[] }
  bounce?: { bounceType?: string, bounceSubType?: string, bouncedRecipients?: { emailAddress: string, diagnosticCode?: string }[] }
  complaint?: { complaintFeedbackType?: string, complainedRecipients?: { emailAddress: string }[] }
  reject?: { reason?: string }
  failure?: { errorMessage?: string }
  deliveryDelay?: { delayType?: string, delayedRecipients?: { emailAddress: string }[] }
}

export const POST: RequestHandler = async ({ request }) => {
  let envelope: SnsEnvelope
  try {
    envelope = JSON.parse(await request.text()) as SnsEnvelope
  } catch {
    return new Response('bad request', { status: ResponseCodes.BAD_REQUEST })
  }

  const allowed_arn = env.SES_SNS_TOPIC_ARN
  if (allowed_arn && envelope.TopicArn !== allowed_arn)
    return new Response('forbidden topic', { status: ResponseCodes.FORBIDDEN })

  if (envelope.Type === 'SubscriptionConfirmation') {
    if (envelope.SubscribeURL && /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//i.test(envelope.SubscribeURL))
      await fetch(envelope.SubscribeURL).catch(err => console.error('SNS confirm fetch failed:', err))
    return new Response('subscription confirmed', { status: ResponseCodes.OK })
  }

  if (envelope.Type === 'Notification' && envelope.Message) {
    let event: SesEvent
    try {
      event = JSON.parse(envelope.Message) as SesEvent
    } catch {
      return new Response('bad message', { status: ResponseCodes.BAD_REQUEST })
    }
    const event_type = event.eventType ?? event.notificationType ?? 'unknown'
    // Routine lifecycle events (every send produces Send + Delivery) log at
    // info; only genuine feedback (bounce/complaint/reject/render-failure)
    // warns, so error reviews aren't flooded by healthy traffic.
    const is_routine = event_type === 'Send' || event_type === 'Delivery' || event_type === 'DeliveryDelay' || event_type === 'unknown'
    log_server_event({
      level: is_routine ? 'info' : 'warn',
      message: 'ses_feedback',
      context: {
        event_type,
        message_id: event.mail?.messageId ?? null,
        destination: event.mail?.destination ?? null,
        bounce_type: event.bounce?.bounceType ?? null,
        bounce_sub_type: event.bounce?.bounceSubType ?? null,
        diagnostic: event.bounce?.bouncedRecipients?.[0]?.diagnosticCode ?? null,
        complaint_type: event.complaint?.complaintFeedbackType ?? null,
        reject_reason: event.reject?.reason ?? null,
        failure: event.failure?.errorMessage ?? null,
        delay_type: event.deliveryDelay?.delayType ?? null,
      },
    })
    return new Response('ok', { status: ResponseCodes.OK })
  }

  return new Response('ignored', { status: ResponseCodes.OK })
}
