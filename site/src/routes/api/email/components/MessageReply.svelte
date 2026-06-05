<script lang="ts">
  import BaseLayout from './BaseLayout.svelte'

  /**
   * Admin reply wrapper. Deliberately uses `show_chrome={false}` and minimal
   * styling so the email reads as a human-authored response, not a templated
   * system notification. Adds only:
   *  - Email-safe typography / line-height
   *  - Mobile-responsive 600px column
   *  - Inbox preheader (snippet of the body)
   *
   * `body_html` is the raw HTML the admin authored (rich text editor output)
   * and is rendered via `{@html}`. The admin is the trust boundary — they
   * authored it.
   */

  interface Props {
    body_html: string
    /** Pre-rendered plain-text fallback used for inbox previews + the snippet
     * before the body. Pass the trimmed first ~150 chars of `body_text`. */
    preheader?: string
    /** Used for <title>. */
    subject?: string
  }

  const { body_html, preheader, subject = 'A reply from Living Dictionaries' }: Props = $props()
</script>

<BaseLayout {preheader} title={subject} show_chrome={false}>
  {@html body_html}
</BaseLayout>

<svelte:options css="injected" />
