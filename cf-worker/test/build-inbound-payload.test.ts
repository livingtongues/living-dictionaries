import type { Email } from 'postal-mime'
import { describe, expect, test } from 'vitest'
import { build_inbound_payload } from '../src/build-inbound-payload'

/**
 * Tests focus on the pure transformer. The MIME-parsing side is postal-mime's
 * job; the email-handler glue in `index.ts` is just `R2.put` + `fetch` +
 * `waitUntil`.
 */

function parsed_email(overrides: Partial<Email> = {}): Email {
  return {
    headers: [],
    from: { address: 'customer@example.com', name: 'Customer' },
    subject: 'Question about translation',
    text: 'Plain text body',
    html: null,
    attachments: [],
    ...overrides,
  } as Email
}

let id_counter = 0
const next_id = () => `attachment-id-${++id_counter}`

const base_args = {
  parsed: parsed_email(),
  envelope_from: 'customer@example.com',
  envelope_to: 'support@polylingual.dev',
  received_at: '2026-05-26T10:00:00.000Z',
  generate_id: next_id,
}

describe(build_inbound_payload, () => {
  test('basic happy path: headers, from, to, subject, body_text', () => {
    const { payload } = build_inbound_payload(base_args)
    expect(payload.from_email).toBe('customer@example.com')
    expect(payload.from_name).toBe('Customer')
    expect(payload.to_email).toBe('support@polylingual.dev')
    expect(payload.subject).toBe('Question about translation')
    expect(payload.body_text).toBe('Plain text body')
    expect(payload.body_html).toBe(null)
    expect(payload.received_at).toBe('2026-05-26T10:00:00.000Z')
  })

  test('lowercases from_email + to_email', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({ from: { address: 'Customer@Example.COM', name: null as unknown as undefined } }),
      envelope_to: 'Support@Polylingual.DEV',
    })
    expect(payload.from_email).toBe('customer@example.com')
    expect(payload.to_email).toBe('support@polylingual.dev')
  })

  test('falls back to envelope_from when header From is absent', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({ from: undefined as unknown as Email['from'] }),
      envelope_from: 'bounce@example.com',
    })
    expect(payload.from_email).toBe('bounce@example.com')
    expect(payload.from_name).toBe(null)
  })

  test('parses References header (space-separated)', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({
        references: '<a@x.com> <b@y.com> <c@z.com>' as unknown as Email['references'],
      }),
    })
    expect(payload.email_references).toEqual(['<a@x.com>', '<b@y.com>', '<c@z.com>'])
  })

  test('empty references → empty array', () => {
    const { payload } = build_inbound_payload(base_args)
    expect(payload.email_references).toEqual([])
  })

  test('captures in_reply_to with angle brackets preserved', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({ inReplyTo: '<original@x.com>' }),
    })
    expect(payload.in_reply_to).toBe('<original@x.com>')
  })

  test('emits metadata-only attachments + matching R2 upload payloads', () => {
    const text_content = 'Hello attachment'
    const bytes = new TextEncoder().encode(text_content)
    const ids = ['fixed-id-1']
    let i = 0
    const { payload, uploads } = build_inbound_payload({
      ...base_args,
      generate_id: () => ids[i++],
      parsed: parsed_email({
        attachments: [{
          filename: 'note.txt',
          mimeType: 'text/plain',
          content: bytes,
          contentId: '<img-1@x.com>',
          disposition: 'inline',
        }] as unknown as Email['attachments'],
      }),
    })
    expect(payload.attachments).toHaveLength(1)
    const [att] = payload.attachments
    expect(att.attachment_id).toBe('fixed-id-1')
    expect(att.filename).toBe('note.txt')
    expect(att.mimetype).toBe('text/plain')
    expect(att.size_bytes).toBe(bytes.byteLength)
    expect(att.disposition).toBe('inline')
    expect(att.content_id).toBe('img-1@x.com')
    expect((att as unknown as { content_b64?: string }).content_b64).toBeUndefined()

    expect(uploads).toHaveLength(1)
    expect(uploads[0].key).toBe('fixed-id-1')
    expect(uploads[0].mimetype).toBe('text/plain')
    expect(new TextDecoder().decode(uploads[0].bytes)).toBe(text_content)
  })

  test('serializes all headers into raw_headers as JSON (using originalKey for case)', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({
        headers: [
          { key: 'subject', originalKey: 'Subject', value: 'Question about translation' },
          { key: 'authentication-results', originalKey: 'Authentication-Results', value: 'spf=pass smtp.mailfrom=example.com' },
        ],
      }),
    })
    const headers = JSON.parse(payload.raw_headers)
    expect(headers.Subject).toBe('Question about translation')
    expect(headers['Authentication-Results']).toContain('spf=pass')
  })

  test('captures CC addresses', () => {
    const { payload } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({
        cc: [
          { address: 'manager@example.com', name: 'Manager' },
          { address: 'team@example.com', name: 'Team' },
        ] as unknown as Email['cc'],
      }),
    })
    expect(payload.cc).toEqual(['manager@example.com', 'team@example.com'])
  })

  test('handles attachment with default fallbacks for missing filename/mimetype', () => {
    const { payload, uploads } = build_inbound_payload({
      ...base_args,
      parsed: parsed_email({
        attachments: [{
          filename: undefined,
          mimeType: undefined,
          content: new Uint8Array([1, 2, 3]),
        }] as unknown as Email['attachments'],
      }),
    })
    const [att] = payload.attachments
    expect(att.filename).toBe('unnamed')
    expect(att.mimetype).toBe('application/octet-stream')
    expect(att.disposition).toBe('attachment')
    expect(att.size_bytes).toBe(3)
    expect(uploads[0].mimetype).toBe('application/octet-stream')
  })
})
