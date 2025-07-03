<script lang="ts">
  import { page } from '$app/stores'

  $: ({ dictionaries } = $page.data)
  $: public_dictionaries = $dictionaries?.filter(dictionary => dictionary.public).length || 0

  const public_entries_count = 254813
</script>

<footer class="print:hidden sticky bottom-0 z-1 bg-white border-t border-gray-200 p-2 text-sm">
  {#if public_dictionaries}
    <span class="whitespace-nowrap">Public Living Dictionaries: <b>{public_dictionaries}</b>,</span>
  {/if}
  <span class="whitespace-nowrap">Dictionary Entries: <b>{new Intl.NumberFormat().format(public_entries_count)}</b>,</span>
  <span>Living Dictionaries is a project of <a href="https://livingtongues.org/" target="_blank" class="underline hover:text-blue-700">Living Tongues Institute for Endangered Languages.</a>
  </span>
  <a href="https://www.facebook.com/living.tongues" target="_blank" class="ml-1 p-1 -my-1 hover:text-blue-700"><i class="i-mage:facebook-square text-xl -mt-1" /></a>
  <a href="https://www.instagram.com/livingtongues" target="_blank" class="p-1 -my-1 hover:text-blue-700"><i class="i-f7:logo-instagram text-xl -mt-1" /></a>
</footer>
