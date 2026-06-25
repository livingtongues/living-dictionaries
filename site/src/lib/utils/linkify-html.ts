/**
 * Turn bare URLs in TipTap-authored HTML into clickable `<a>` links, without
 * touching URLs that are already inside an anchor (or `<code>`/`<pre>`).
 *
 * Why this exists: the chat composer's TipTap autolinker only fires on a word
 * boundary (typing a space/Enter after the URL). A URL typed and immediately
 * sent with Ctrl+Enter — or pasted and sent — lands in `body_html` as plain
 * text. This is the render-/send-time safety net so links always render in the
 * team chat (and its notification emails).
 *
 * Policy mirrors `should-autolink.ts`: only link tokens carrying an explicit
 * `http(s)://` scheme or a leading `www.` — never bare domains or filenames
 * (`.zip`, `.app`, `shared.db`, …).
 *
 * Pure string transform (no DOM) so it's safe on the server and under SSR, and
 * idempotent: re-running it never double-wraps an already-linked URL.
 */

const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/gi
const SKIP_TAGS = new Set(['a', 'code', 'pre'])

export function linkify_html(html: string): string {
  if (!html || !/https?:\/\/|www\./i.test(html))
    return html

  const parts = html.split(/(?<token><[^>]+>)/)
  const skip_stack: string[] = []
  let result = ''

  for (const part of parts) {
    if (!part)
      continue
    if (part[0] === '<') {
      const tag = part.match(/^<\/?\s*(?<tag>[a-z][a-z0-9]*)/i)?.groups?.tag?.toLowerCase()
      if (tag && SKIP_TAGS.has(tag) && !part.endsWith('/>')) {
        if (part[1] === '/') {
          const idx = skip_stack.lastIndexOf(tag)
          if (idx !== -1)
            skip_stack.splice(idx, 1)
        } else {
          skip_stack.push(tag)
        }
      }
      result += part
      continue
    }
    result += skip_stack.length ? part : linkify_text(part)
  }

  return result
}

function linkify_text(text: string): string {
  return text.replace(URL_RE, (match) => {
    const [url, trailing] = split_trailing(match)
    if (!url)
      return match
    const href = /^www\./i.test(url) ? `http://${url}` : url
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`
  })
}

/**
 * Peel sentence punctuation off the end of a matched URL — `.,;:!?`, a closing
 * quote, or an unbalanced closing bracket — so "see https://x.com." doesn't link
 * the trailing period while "…/Foo_(bar)" keeps its balanced paren.
 */
function split_trailing(url: string): [string, string] {
  let end = url.length
  while (end > 0) {
    const ch = url[end - 1]
    if ('.,;:!?"\''.includes(ch)) {
      end--
      continue
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = ch === ')' ? '(' : ch === ']' ? '[' : '{'
      const head = url.slice(0, end)
      if (count_char(head, ch) > count_char(head, open)) {
        end--
        continue
      }
    }
    break
  }
  return [url.slice(0, end), url.slice(end)]
}

function count_char(text: string, char: string): number {
  let count = 0
  for (const ch of text) {
    if (ch === char)
      count++
  }
  return count
}

if (import.meta.vitest) {
  describe(linkify_html, () => {
    it('links an explicit http(s) URL in plain text', () => {
      expect(linkify_html('<p>See https://livingdictionaries.app/x for more</p>'))
        .toBe('<p>See <a href="https://livingdictionaries.app/x" target="_blank" rel="noopener noreferrer">https://livingdictionaries.app/x</a> for more</p>')
    })

    it('links a www. host with an http:// href but www. visible text', () => {
      expect(linkify_html('<p>www.example.com</p>'))
        .toBe('<p><a href="http://www.example.com" target="_blank" rel="noopener noreferrer">www.example.com</a></p>')
    })

    it('does not link bare domains or filenames', () => {
      expect(linkify_html('<p>open example.com or shared.db</p>'))
        .toBe('<p>open example.com or shared.db</p>')
    })

    it('does not double-link a URL already inside an anchor', () => {
      const already = '<p><a href="https://livingdictionaries.app">https://livingdictionaries.app</a></p>'
      expect(linkify_html(already)).toBe(already)
    })

    it('skips URLs inside <code>', () => {
      const code = '<p><code>https://livingdictionaries.app</code></p>'
      expect(linkify_html(code)).toBe(code)
    })

    it('strips a trailing period from the link', () => {
      expect(linkify_html('<p>go to https://livingdictionaries.app.</p>'))
        .toBe('<p>go to <a href="https://livingdictionaries.app" target="_blank" rel="noopener noreferrer">https://livingdictionaries.app</a>.</p>')
    })

    it('drops an unbalanced trailing paren but keeps a balanced one', () => {
      expect(linkify_html('<p>(see https://en.wikipedia.org/wiki/Foo_(bar))</p>'))
        .toBe('<p>(see <a href="https://en.wikipedia.org/wiki/Foo_(bar)" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Foo_(bar)</a>)</p>')
    })

    it('preserves &amp; entities in a query string', () => {
      expect(linkify_html('<p>https://x.com/?a=1&amp;b=2 end</p>'))
        .toBe('<p><a href="https://x.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://x.com/?a=1&amp;b=2</a> end</p>')
    })

    it('links multiple URLs in one segment', () => {
      expect(linkify_html('<p>https://a.com and https://b.com</p>'))
        .toBe('<p><a href="https://a.com" target="_blank" rel="noopener noreferrer">https://a.com</a> and <a href="https://b.com" target="_blank" rel="noopener noreferrer">https://b.com</a></p>')
    })

    it('is idempotent', () => {
      const once = linkify_html('<p>See https://livingdictionaries.app/x now</p>')
      expect(linkify_html(once)).toBe(once)
    })

    it('returns input unchanged when there is nothing to link', () => {
      expect(linkify_html('<p>just some words</p>')).toBe('<p>just some words</p>')
    })
  })
}
