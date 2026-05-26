<script lang="ts">
  /**
   * Email-safe HTML scaffold. Wraps `children` in:
   *  - <!DOCTYPE html> via the render helper (not here — the doctype is
   *    prepended after Svelte SSR; this component just emits <html>...</html>)
   *  - <head> with charset, viewport, format-detection meta tags + minimal
   *    reset CSS that survives Outlook / Gmail / Apple Mail
   *  - <body> with a centered 600px <table> column (the only layout primitive
   *    every email client renders consistently)
   *  - Optional `preheader` text (hidden snippet shown in inbox previews)
   *  - Optional LD-branded header / footer (system emails want them; admin
   *    replies set show_chrome={false} for a clean, human-feeling email)
   *
   * Styles live inline on every element OR in the <head> <style> block. We
   * use both: inline for layout-critical (width, padding), <style> for
   * dark-mode prefers-color-scheme media queries that inline can't express.
   */

  interface Props {
    /** Inbox preview text (hidden in the body via a wrapper that pushes height to 0). */
    preheader?: string
    /** <title> — invisible to recipients but used by some clients. */
    title?: string
    /** When false, hides the LD header + footer (use for admin reply emails). */
    show_chrome?: boolean
    children?: import('svelte').Snippet
  }

  const {
    preheader = '',
    title = 'Living Dictionaries',
    show_chrome = true,
    children,
  }: Props = $props()

  const brand = 'Living Dictionaries'
  const brand_url = 'https://livingdictionaries.app'
  const primary_color = '#546e7a'
  const text_color = '#111827'
  const muted_color = '#6b7280'
  const bg_color = '#f9fafb'
  const surface_color = '#ffffff'
  const border_color = '#e5e7eb'
</script>

<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="IE=Edge">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>{title}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
      img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
      .ExternalClass { width: 100%; }
      .ExternalClass * { line-height: 100%; }
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #0b0b0d !important; }
        .surface { background-color: #18181b !important; }
        .text { color: #f3f4f6 !important; }
        .muted { color: #9ca3af !important; }
        .border { border-color: #27272a !important; }
      }
    </style>
  </head>
  <body
    class="body-bg"
    style="margin: 0; padding: 0; width: 100%; background-color: {bg_color}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: {text_color};">

    {#if preheader}
      <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
        {preheader}
      </div>
    {/if}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="body-bg" style="background-color: {bg_color};">
      <tbody>
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="surface" style="max-width: 600px; width: 100%; background-color: {surface_color}; border: 1px solid {border_color}; border-radius: 12px; overflow: hidden;">
              <tbody>

                {#if show_chrome}
                  <tr>
                    <td class="border" style="padding: 20px 28px; border-bottom: 1px solid {border_color};">
                      <a href={brand_url} style="text-decoration: none; color: {primary_color}; font-weight: 700; font-size: 18px;">
                        {brand}
                      </a>
                    </td>
                  </tr>
                {/if}

                <tr>
                  <td class="text" style="padding: 28px; font-size: 16px; line-height: 1.55; color: {text_color};">
                    {@render children?.()}
                  </td>
                </tr>

                {#if show_chrome}
                  <tr>
                    <td class="border muted" style="padding: 20px 28px; border-top: 1px solid {border_color}; font-size: 12px; color: {muted_color};">
                      <p style="margin: 0 0 8px;">
                        <a href={brand_url} style="color: {muted_color}; text-decoration: underline;">{brand_url.replace('https://', '')}</a>
                      </p>
                      <p style="margin: 0;">
                        You're receiving this because someone (hopefully you) used this address with {brand}.
                      </p>
                    </td>
                  </tr>
                {/if}

              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

<svelte:options css="injected" />
