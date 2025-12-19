<script lang="ts">
  interface Props {
    preview?: string;
  }

  let { preview = '' }: Props = $props();

  const add_whitespace_to_fill_remaining_preview_area = (text: string) => {
    const whiteSpaceCodes = '\xA0\u200C\u200B\u200D\u200E\u200F\uFEFF'
    return whiteSpaceCodes.repeat(150 - text.length)
  }
</script>

<!-- HIDDEN PREHEADER TEXT -->
<div id="__email-preview" style="display: none; font-size: 1px; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0;">
  {preview}
  <div>
    {add_whitespace_to_fill_remaining_preview_area(preview)}
  </div>
</div>
