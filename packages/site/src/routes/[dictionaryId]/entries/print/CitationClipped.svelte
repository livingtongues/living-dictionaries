<script lang="ts">
  export let citation:string;
  export let citationText:string;
  const maxLength = 167; //Number based if it looks well on letter format
  let citationClipped: string,
    textsSum: number;
  $: if (citation && citationText) {
    textsSum = citation.length + citationText.length;
    if (textsSum > maxLength) {
      // When they follow the pattern: [Last name] [First letter from first name].,  
      citationClipped = citation.split('.,')[0];
      // Otherwise, we only consider the first word
      if (citation === citationClipped) {
        citationClipped = citation.match(/\w+/gm)[0];
      }
    }
  }
</script>

<div
  dir="ltr"
  class="text-xs print:fixed print:text-center right-0 top-0 bottom-0"
  style="writing-mode: tb;">
  {textsSum > maxLength ? citationClipped + ' . et al. ' : citation}
  {citationText}
</div>
