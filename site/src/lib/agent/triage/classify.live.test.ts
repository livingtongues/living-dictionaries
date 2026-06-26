import type { TriageContext } from './build-context'
import { grok_triage_client } from './classify'
import { TRIAGE_CATEGORIES, TRIAGE_CONFIDENCE, TRIAGE_VERDICTS } from './constants'

/**
 * LIVE smoke test against the real xAI API — the one thing unit tests can't
 * cover: that `grok-4.3` + the direct `response_format: json_schema` call
 * actually returns valid structured output for LD's domain. SKIPPED unless
 * `XAI_API_KEY` is set, so normal `pnpm test` never hits the network or spends
 * money.
 *
 * Run it where the key lives:
 *   XAI_API_KEY=sk-... pnpm vitest run src/lib/agent/triage/classify.live.test.ts
 */

const has_key = !!process.env.XAI_API_KEY

function ctx(partial: Partial<TriageContext> & { messages: TriageContext['messages'] }): TriageContext {
  return {
    subject: null,
    from_name: 'Test Writer',
    from_email: 'test@example.com',
    to_email: 'support@livingdictionaries.app',
    is_known_customer: false,
    page_context: null,
    url: null,
    dictionaries: [],
    prior_thread_count: 0,
    ...partial,
  }
}

function assert_valid_shape(result: Awaited<ReturnType<typeof grok_triage_client.classify>>) {
  expect(TRIAGE_VERDICTS).toContain(result.verdict)
  expect(TRIAGE_CATEGORIES).toContain(result.category)
  expect(TRIAGE_CONFIDENCE).toContain(result.confidence)
  expect(typeof result.summary).toBe('string')
  expect(result.summary).not.toBe('')
  expect(typeof result.advice).toBe('string')
}

describe.skipIf(!has_key)('grok-4.3 live classification', () => {
  test('access request → account, with a draft', { timeout: 90_000 }, async () => {
    const result = await grok_triage_client.classify(ctx({
      subject: 'Editor access please',
      is_known_customer: true,
      page_context: 'the "Nuxalk" dictionary — the contributors page',
      dictionaries: [{ name: 'Nuxalk', role: 'contributor', entry_count: 412, is_public: true }],
      messages: [{ author: 'customer', at: '2026-06-24T00:00:00Z', text: 'The manager asked me to help add words. Could you give me editor access to the Nuxalk dictionary?' }],
    }))
    console.info('[live] access →', JSON.stringify(result, null, 2))
    assert_valid_shape(result)
    expect(result.verdict).toBe('human')
    expect(result.category).toBe('account')
    expect(result.draft_reply).toBeTruthy()
  })

  test('partnership proposal → partnership, draft withheld', { timeout: 90_000 }, async () => {
    const result = await grok_triage_client.classify(ctx({
      subject: 'Collaboration proposal',
      messages: [{ author: 'customer', at: '2026-06-24T00:00:00Z', text: 'I direct a language revitalization nonprofit and we would love to partner with Living Tongues to host dictionaries for three Indigenous communities, including possible co-funding.' }],
    }))
    console.info('[live] partnership →', JSON.stringify(result, null, 2))
    assert_valid_shape(result)
    expect(result.category).toBe('partnership')
    expect(result.draft_reply).toBeNull()
  })

  test('fake invoice → spam', { timeout: 90_000 }, async () => {
    const result = await grok_triage_client.classify(ctx({
      subject: 'FINAL NOTICE: invoice overdue',
      messages: [{ author: 'customer', at: '2026-06-24T00:00:00Z', text: 'Your Living Dictionaries invoice #44192 of $89.00 is overdue. Pay immediately at http://ld-billing-secure.example/pay to avoid suspension.' }],
    }))
    console.info('[live] spam →', JSON.stringify(result, null, 2))
    assert_valid_shape(result)
    expect(result.verdict).toBe('spam')
  })
})
