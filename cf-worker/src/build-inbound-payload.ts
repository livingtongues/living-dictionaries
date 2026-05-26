import type { Address, Email } from 'postal-mime'
import type { AttachmentPayload, MessagesEmailInboundRequestBody } from './types'

function pick_mailbox_address(addr: Address | undefined): { address: string, name: string } | null {
  if (!addr)
    return null
  if ('address' in addr && addr.address)
    return { address: addr.address, name: addr.name || '' }
  // Group form — pick the first member's address if any.
  if ('group' in addr && addr.group && addr.group[0])
    return { address: addr.group[0].address, name: addr.group[0].name || '' }
  return null
}

/**
 * Result of parsing + uploading: the payload to POST to the VPS, plus the
 * `{ key, bytes, mimetype }` triples the caller must `ATTACHMENTS.put(...)`
 * into R2 before sending. Separating "what to upload" from "what to POST"
 * keeps this function pure (no I/O) so it stays trivially unit-testable;
 * `index.ts` does the actual R2 writes + VPS POST.
 */
export interface BuildInboundResult {
  payload: MessagesEmailInboundRequestBody
  uploads: { key: string, bytes: Uint8Array, mimetype: string }[]
}

/**
 * Pure transformer: postal-mime's parsed `Email` + envelope from/to → the
 * VPS-side payload contract + the list of R2 puts the caller must perform.
 */
export function build_inbound_payload({ parsed, envelope_from, envelope_to, received_at, generate_id }: {
  parsed: Email
  envelope_from: string
  envelope_to: string
  received_at: string
  generate_id: () => string
}): BuildInboundResult {
  // Prefer the parsed `From:` header (display name + address) but fall back
  // to envelope `MAIL FROM` if absent. Envelope is more reliable for routing;
  // header is more reliable for human display.
  const header_from = pick_mailbox_address(parsed.from)
  const from_email = (header_from?.address || envelope_from).trim().toLowerCase()
  const from_name = header_from?.name?.trim() || null

  // Parse `References:` header (space-separated angle-bracketed IDs).
  const email_references: string[] = []
  const references_raw = parsed.references
  if (typeof references_raw === 'string') {
    for (const id of references_raw.split(/\s+/)) {
      const trimmed = id.trim()
      if (trimmed)
        email_references.push(trimmed)
    }
  }

  // Audit-friendly raw header bag.
  const headers_for_log: Record<string, string> = {}
  if (parsed.headers) {
    for (const h of parsed.headers) {
      const name = h.originalKey || h.key
      headers_for_log[name] = h.value
    }
  }

  const cc_addresses: string[] | undefined = parsed.cc
    ? parsed.cc.map(pick_mailbox_address).filter((a): a is { address: string, name: string } => !!a).map(a => a.address)
    : undefined

  const attachments: AttachmentPayload[] = []
  const uploads: { key: string, bytes: Uint8Array, mimetype: string }[] = []
  for (const att of parsed.attachments ?? []) {
    const attachment_id = generate_id()
    const mimetype = att.mimeType || 'application/octet-stream'
    const bytes = content_to_bytes(att.content)
    uploads.push({ key: attachment_id, bytes, mimetype })
    attachments.push({
      attachment_id,
      filename: att.filename || 'unnamed',
      mimetype,
      size_bytes: bytes.byteLength,
      content_id: att.contentId
        ? att.contentId.replace(/^<|>$/g, '') // strip angle brackets
        : null,
      disposition: att.disposition === 'inline' ? 'inline' : 'attachment',
    })
  }

  return {
    payload: {
      message_id: (parsed.messageId || '').trim(),
      in_reply_to: parsed.inReplyTo?.trim() || null,
      email_references,
      from_email,
      from_name,
      to_email: envelope_to.trim().toLowerCase(),
      cc: cc_addresses,
      subject: parsed.subject || '',
      body_text: parsed.text || null,
      body_html: parsed.html || null,
      raw_headers: JSON.stringify(headers_for_log),
      received_at,
      attachments,
    },
    uploads,
  }
}

/** postal-mime's `Attachment.content` can be ArrayBuffer / Uint8Array / string. */
function content_to_bytes(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof content === 'string')
    return new TextEncoder().encode(content)
  return content instanceof Uint8Array ? content : new Uint8Array(content)
}
