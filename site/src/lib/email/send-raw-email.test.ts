import { describe, expect, test } from 'vitest'
import { compose_raw_mime } from './send-raw-email'

const base_parts = {
  from: { email: 'support@example.com', name: 'Support' },
  to: { email: 'user@example.com', name: 'Z. User' },
  subject: 'Re: 你好 question',
  message_id: '<abc123@example.com>',
}

/** Everything before the first blank line — the message-level headers. */
function header_block(raw: string): string {
  return raw.split('\r\n\r\n')[0]
}

describe(compose_raw_mime, () => {
  test('builds a multipart/alternative message with base64 UTF-8 bodies', () => {
    const text = '你好 — plain reply'
    const html = '<p>你好 — <b>html</b> reply</p>'
    const raw = compose_raw_mime({ ...base_parts, text_body: text, html_body: html })

    expect(raw).toContain('Content-Type: multipart/alternative')
    expect(raw).toContain('Content-Transfer-Encoding: base64')
    expect(raw).toContain(Buffer.from(text, 'utf-8').toString('base64'))
    expect(raw).toContain(Buffer.from(html, 'utf-8').toString('base64'))
  })

  test('RFC 2047-encodes a non-ASCII subject', () => {
    const raw = compose_raw_mime({ ...base_parts, text_body: 'hi' })
    const encoded = Buffer.from(base_parts.subject, 'utf-8').toString('base64')
    expect(header_block(raw)).toContain(`Subject: =?utf-8?B?${encoded}?=`)
  })

  test('sets threading + provenance headers', () => {
    const raw = compose_raw_mime({
      ...base_parts,
      text_body: 'hi',
      in_reply_to: '<prev@example.com>',
      references: ['<root@example.com>', '<prev@example.com>'],
      auto_submitted: 'auto-generated',
    })
    const headers = header_block(raw)
    expect(headers).toContain('Message-ID: <abc123@example.com>')
    expect(headers).toContain('In-Reply-To: <prev@example.com>')
    expect(headers).toContain('References: <root@example.com> <prev@example.com>')
    expect(headers).toContain('Auto-Submitted: auto-generated')
    expect(headers).toContain('MIME-Version: 1.0')
  })

  test('defaults Auto-Submitted to no and Reply-To to From', () => {
    const raw = compose_raw_mime({ ...base_parts, text_body: 'hi' })
    const headers = header_block(raw)
    expect(headers).toContain('Auto-Submitted: no')
    expect(headers).toMatch(/Reply-To:.*support@example\.com/)
  })

  test('includes cc + bcc recipients', () => {
    const raw = compose_raw_mime({
      ...base_parts,
      text_body: 'hi',
      cc: [{ email: 'cc@example.com' }],
      bcc: [{ email: 'bcc@example.com' }],
    })
    const headers = header_block(raw)
    expect(headers).toMatch(/Cc:.*cc@example\.com/)
    expect(headers).toMatch(/Bcc:.*bcc@example\.com/)
  })

  test('attaches files with base64 content + correct disposition', () => {
    const pdf = Buffer.from('%PDF-1.4 fake pdf bytes', 'utf-8')
    const raw = compose_raw_mime({
      ...base_parts,
      html_body: '<p>see attached</p>',
      attachments: [
        { filename: 'report.pdf', content: pdf, mimetype: 'application/pdf' },
        { filename: 'logo.png', content: Buffer.from('PNGDATA'), mimetype: 'image/png', disposition: 'inline', content_id: 'logo@example.com' },
      ],
    })
    expect(raw).toContain('Content-Type: multipart/mixed')
    expect(raw).toContain('Content-Disposition: attachment; filename="report.pdf"')
    expect(raw).toContain(pdf.toString('base64'))
    expect(raw).toContain('Content-Disposition: inline; filename="logo.png"')
    expect(raw).toContain('Content-ID: <logo@example.com>')
  })

  test('uses CRLF line endings throughout', () => {
    const raw = compose_raw_mime({ ...base_parts, text_body: 'hi' })
    expect(raw).toContain('\r\n')
    expect(raw).not.toMatch(/[^\r]\n/)
  })

  test('throws when neither body is provided', () => {
    expect(() => compose_raw_mime({ ...base_parts })).toThrow()
  })
})
