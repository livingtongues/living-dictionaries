<script lang="ts">
  import { page } from '$app/stores'

  export let link: string
  export let label: string
</script>

<a
  href={`/admin/${link}`}
  class={$page.url.href.split('/').pop() === link ? 'active' : 'inactive'}>
  {label}
</a>

<style>
  .active {
    --at-apply: border-blue-500 text-blue-600 focus:text-blue-800 focus:border-blue-700;
  }
  .inactive {
    --at-apply: border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:text-gray-700 focus:border-gray-300;
  }
  a {
    --at-apply: mr-8 py-4 px-1 border-b-2 font-medium text-sm leading-5
        focus:outline-none capitalize;
  }
</style>
