<script lang="ts">
  // import { slide } from 'svelte/transition'
  import { page } from '$app/stores'

  $: ({ dictionaries } = $page.data)
  $: public_dictionaries = $dictionaries?.filter(dictionary => dictionary.public).length || 0
  $: public_entries_count = $page.data.public_entries_count?.data.count || 0
  let show_statistics = false
</script>

<footer class="print:hidden fixed bottom-0 left-0 right-0 flex items-center justify-left bg-white h-14 z-2 whitespace-nowrap border-t border-gray-200">
  <div class="lg:text-sm text-xs  overflow-x-auto md:overflow-hidden py-6 pl-3">
    <p class="sm:block inline">
      <button on:click={() => show_statistics = !show_statistics} type="button" class="i-ion:bar-chart sm:hidden cursor-pointer" />
      <span class:hidden={show_statistics} class="sm:inline hidden">
        Total number of public Living Dictionaries: {public_dictionaries}. Total number of dictionary entries: {public_entries_count}.
      </span>
    </p>
    <p class:block={!show_statistics} class="sm:block inline">
      <span class="sm:inline hidden">Living Dictionaries is a project of <a href="https://livingtongues.org/" target="_blank" class="underline">Living Tongues Institute for Endangered Languages.</a> </span>
      <a href="https://www.facebook.com/living.tongues" target="_blank"><i class="i-mage:facebook-square text-[13.4px]" /></a> <a href="https://www.instagram.com/livingtongues" target="_blank"><i class="i-f7:logo-instagram" /></a>
    </p>
  </div>
</footer>
