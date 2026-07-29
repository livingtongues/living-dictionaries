<script lang="ts">
  interface Props {
    /**
     * Inbox preview ("preheader") text. EMPTY renders NOTHING at all, so the
     * client falls back to showing the start of the body copy — the normal
     * email default, and better than repeating the subject line.
     */
    preview?: string
  }

  const { preview = '' }: Props = $props()

  /**
   * Pad the preheader out with zero-width / no-break characters so the email's
   * own body copy can't bleed into the inbox preview line after it.
   * GOTCHA: `repeat()` throws a RangeError on a negative count — text longer
   * than the fill target simply needs no padding.
   */
  const add_whitespace_to_fill_remaining_preview_area = (text: string) => {
    const whiteSpaceCodes = '\xA0\u200C\u200B\u200D\u200E\u200F\uFEFF'
    return whiteSpaceCodes.repeat(Math.max(0, 150 - text.length))
  }
</script>

{#if preview}
  <!-- HIDDEN PREHEADER TEXT -->
  <div id="__email-preview" style="display: none; font-size: 1px; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0;">
    {preview}
    <div>
      {add_whitespace_to_fill_remaining_preview_area(preview)}
    </div>
  </div>
{/if}
