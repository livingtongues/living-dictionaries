<script lang="ts">
  // import { slide } from 'svelte/transition'
  import { page } from '$app/stores'

  $: ({ dictionaries } = $page.data)
  $: public_dictionaries = $dictionaries?.filter(dictionary => dictionary.public).length || 0

  let show_statistics = false
</script>

<footer class="print:hidden fixed bottom-0 left-0 right-0 flex items-center justify-left bg-white h-14 z-2 whitespace-nowrap border-t border-gray-200">
  <div class="lg:text-sm text-xs  overflow-x-auto md:overflow-hidden py-6 pl-3">
    <p>
      <span class:hidden={show_statistics} class="sm:inline hidden">
        Total number of public Living Dictionaries: {public_dictionaries}. Total number of dictionary entries: XX.
      </span>
      <button on:click={() => show_statistics = !show_statistics} type="button" class="i-fluent-mdl2:chart sm:hidden cursor-pointer" />
    </p>
    <p>
      <span class="sm:inline hidden">Living Dictionaries is a project of <a href="https://livingtongues.org/" target="_blank" class="underline">Living Tongues Institute for Endangered Languages.</a> </span>
      <i class="i-mage:facebook-square" /> <i class="i-f7:logo-instagram" />
    </p>
  </div>
</footer>
