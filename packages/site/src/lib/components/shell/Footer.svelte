<script lang="ts">
  import { page } from '$app/stores'

  $: ({ dictionaries } = $page.data)
  $: public_dictionaries = $dictionaries?.filter(dictionary => dictionary.public).length || 0
</script>

<footer class="print:hidden fixed bottom-0 left-0 right-0 flex items-center justify-left bg-white h-14 z-2 whitespace-nowrap border-t border-gray-200">
  <div class="lg:text-sm text-xs  overflow-x-auto md:overflow-hidden py-6 pl-3">
    <p>Total number of public Living Dictionaries:  {public_dictionaries}.  Total number of dictionary entries: XX.</p>
    <p>Living Dictionaries is a project of <a href="https://livingtongues.org/" target="_blank" class="underline">Living Tongues Institute for Endangered Languages</a>. <i class="i-mage:facebook-square" /> <i class="i-f7:logo-instagram" /></p>
  </div>
</footer>
