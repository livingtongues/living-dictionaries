import type { TriageContext } from './build-context'
import type { TriageResult } from './types'
import { env } from '$env/dynamic/private'
import { build_triage_user_prompt, TRIAGE_SYSTEM_PROMPT } from './build-prompt'
import { GROK_MODEL, TRIAGE_CATEGORIES, TRIAGE_CONFIDENCE, TRIAGE_VERDICTS } from './constants'

/**
 * Stateless, TOOLLESS classification call. Read-only by construction: the model
 * has no tools, so it cannot write or act — it only returns structured JSON,
 * which the server then applies. Injectable so apply/orchestration can be tested
 * without hitting xAI.
 *
 * Talks to xAI directly (no Vercel AI SDK) — a single POST to the
 * OpenAI-compatible chat-completions endpoint with `response_format:
 * json_schema` for guaranteed structured output.
 */
export interface TriageClient {
  readonly id: string
  classify: (ctx: TriageContext) => Promise<TriageResult>
}

/** xAI's OpenAI-compatible chat-completions endpoint. */
const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'

/**
 * Structured-output spec. `strict: true` is what guarantees the model returns
 * exactly this shape — it requires `additionalProperties: false` and every
 * property listed in `required`.
 */
const TRIAGE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'triage_result',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['verdict', 'category', 'confidence', 'summary', 'advice', 'draft_reply', 'spam_reason'],
      properties: {
        verdict: { type: 'string', enum: [...TRIAGE_VERDICTS] },
        category: { type: 'string', enum: [...TRIAGE_CATEGORIES] },
        confidence: { type: 'string', enum: [...TRIAGE_CONFIDENCE] },
        summary: { type: 'string', description: 'One concise line for the admin inbox.' },
        advice: { type: 'string', description: 'Internal admin-facing guidance. Never shown to the customer.' },
        draft_reply: { type: ['string', 'null'], description: 'Customer-facing draft, or null when withheld (partnership, spam).' },
        spam_reason: { type: ['string', 'null'], description: 'Why it is spam/phishing, or null when verdict is human.' },
      },
    },
  },
}

/** Default production client — Grok via a direct xAI API call. */
export const grok_triage_client: TriageClient = {
  id: `xai/${GROK_MODEL}`,
  async classify(ctx: TriageContext): Promise<TriageResult> {
    if (!env.XAI_API_KEY)
      throw new Error('XAI_API_KEY is not configured')

    const response = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
          { role: 'user', content: build_triage_user_prompt(ctx) },
        ],
        response_format: TRIAGE_RESPONSE_FORMAT,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`xAI triage failed (${response.status}): ${detail.slice(0, 500)}`)
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content)
      throw new Error('xAI triage returned no content')

    return normalize_result(JSON.parse(content) as TriageResult)
  },
}

/**
 * Defensive normalization — enforce our invariants regardless of what the model
 * returns: partnership + spam never carry a customer draft; human verdicts have
 * no spam_reason.
 */
export function normalize_result(result: TriageResult): TriageResult {
  const draft_reply = result.verdict === 'spam' || result.category === 'partnership'
    ? null
    : (result.draft_reply?.trim() ? result.draft_reply : null)
  return {
    ...result,
    draft_reply,
    spam_reason: result.verdict === 'spam' ? (result.spam_reason ?? 'Flagged as spam.') : null,
  }
}

if (import.meta.vitest) {
  test('normalize strips draft for partnership', () => {
    const out = normalize_result({
      verdict: 'human', category: 'partnership', confidence: 'high',
      summary: 's', advice: 'a', draft_reply: 'should be removed', spam_reason: null,
    })
    expect(out.draft_reply).toBeNull()
  })

  test('normalize strips draft + forces spam_reason for spam', () => {
    const out = normalize_result({
      verdict: 'spam', category: 'other', confidence: 'high',
      summary: 's', advice: 'a', draft_reply: 'nope', spam_reason: null,
    })
    expect(out.draft_reply).toBeNull()
    expect(out.spam_reason).toBe('Flagged as spam.')
  })

  test('normalize clears spam_reason on human verdict', () => {
    const out = normalize_result({
      verdict: 'human', category: 'technical', confidence: 'high',
      summary: 's', advice: 'a', draft_reply: 'hi', spam_reason: 'stray',
    })
    expect(out.spam_reason).toBeNull()
    expect(out.draft_reply).toBe('hi')
  })
}
