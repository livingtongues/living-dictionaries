/**
 * Predicate for TipTap's Link extension `shouldAutoLink`. Only auto-link a token
 * that is unambiguously a URL — one carrying an explicit `http(s)://` scheme or a
 * leading `www.`.
 *
 * TipTap's default autolinker uses linkifyjs, which treats any `name.tld` token as
 * a link. Since `.zip`, `.mov`, `.app`, etc. are now real gTLDs, bare filenames and
 * version-ish strings (e.g. `house-source-2026-06-24.zip`) were being silently
 * turned into links like `http://house-source-2026-06-24.zip`. The toolbar link
 * button still lets you link any text by hand.
 */
export function should_autolink(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^www\./i.test(url)
}

if (import.meta.vitest) {
  describe(should_autolink, () => {
    it('links explicit http(s) URLs', () => {
      expect(should_autolink('https://example.com/a.zip?sig=abc')).toBe(true)
      expect(should_autolink('http://example.com')).toBe(true)
    })
    it('links www-prefixed hosts', () => {
      expect(should_autolink('www.example.com')).toBe(true)
    })
    it('does not link bare filenames whose extension is a real gTLD', () => {
      expect(should_autolink('house-source-2026-06-24.zip')).toBe(false)
      expect(should_autolink('demo.mov')).toBe(false)
      expect(should_autolink('shared.db')).toBe(false)
    })
    it('does not link bare domains without a scheme', () => {
      expect(should_autolink('example.com')).toBe(false)
      expect(should_autolink('hvsb.app')).toBe(false)
    })
  })
}
