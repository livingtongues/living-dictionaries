<script lang="ts">
  export let link = '';
  import { page } from '$app/stores';
</script>

<a
  sveltekit:prefetch
  href={`/admin/${link}`}
  class={$page.url.pathname.match(/(\w+)$/)[0] === link ? 'active' : 'inactive'}>
  {link}
</a>

<style>
  .active {
    @apply border-primary-500 text-primary-600 focus:text-primary-800 focus:border-primary-700;
  }
  .inactive {
    @apply border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:text-gray-700 focus:border-gray-300;
  }
  a {
    @apply mr-8 py-4 px-1 border-b-2 font-medium text-sm leading-5
        focus:outline-none capitalize;
  }
</style>
