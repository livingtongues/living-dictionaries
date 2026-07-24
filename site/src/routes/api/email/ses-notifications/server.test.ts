import { beforeEach, describe, expect, test, vi } from 'vitest'
import { POST } from './+server'

const { env, log_server_event } = vi.hoisted(() => ({
  env: { SES_SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789012:ses-feedback' },
  log_server_event: vi.fn(),
}))

vi.mock('$env/dynamic/private', () => ({ env }))
vi.mock('$lib/server/log-server-event', () => ({ log_server_event }))

const matching_topic_arn = 'arn:aws:sns:us-east-1:123456789012:ses-feedback'

function call(envelope: Record<string, unknown>) {
  const request = new Request('http://localhost/api/email/ses-notifications', {
    method: 'POST',
    body: JSON.stringify(envelope),
  })
  return POST({ request } as Parameters<typeof POST>[0])
}

describe(POST, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    env.SES_SNS_TOPIC_ARN = matching_topic_arn
  })

  test.each([
    ['missing', undefined],
    ['mismatched', 'arn:aws:sns:us-east-1:123456789012:other-topic'],
  ])('rejects a %s TopicArn before notification handling', async (_case, topic_arn) => {
    const response = await call({
      Type: 'Notification',
      ...(topic_arn ? { TopicArn: topic_arn } : {}),
      Message: JSON.stringify({ eventType: 'Bounce' }),
    })

    expect(response.status).toBe(403)
    expect(log_server_event).not.toHaveBeenCalled()
  })

  test.each([
    ['missing', undefined],
    ['mismatched', 'arn:aws:sns:us-east-1:123456789012:other-topic'],
  ])('rejects a %s TopicArn before subscription confirmation', async (_case, topic_arn) => {
    const fetch_spy = vi.spyOn(globalThis, 'fetch')
    const response = await call({
      Type: 'SubscriptionConfirmation',
      ...(topic_arn ? { TopicArn: topic_arn } : {}),
      SubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription',
    })

    expect(response.status).toBe(403)
    expect(fetch_spy).not.toHaveBeenCalled()
    fetch_spy.mockRestore()
  })

  test('handles a notification with the matching TopicArn', async () => {
    const response = await call({
      Type: 'Notification',
      TopicArn: matching_topic_arn,
      Message: JSON.stringify({ eventType: 'Bounce', mail: { messageId: 'message-1' } }),
    })

    expect(response.status).toBe(200)
    expect(log_server_event).toHaveBeenCalledOnce()
    expect(log_server_event).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      message: 'ses_feedback',
      context: expect.objectContaining({ event_type: 'Bounce', message_id: 'message-1' }),
    }))
  })

  test('confirms a subscription with the matching TopicArn', async () => {
    const fetch_spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    const subscribe_url = 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription'
    const response = await call({
      Type: 'SubscriptionConfirmation',
      TopicArn: matching_topic_arn,
      SubscribeURL: subscribe_url,
    })

    expect(response.status).toBe(200)
    expect(fetch_spy).toHaveBeenCalledWith(subscribe_url)
    fetch_spy.mockRestore()
  })
})
