<script lang="ts">
  import { page } from '$app/stores'

  interface Props {
    link: string;
    label: string;
  }

  let { link, label }: Props = $props();
</script>

<a
  href={`/admin/${link}`}
  class={$page.url.href.split('/').pop() === link ? 'active' : 'inactive'}>
  {label}
</a>

<style>
  .active {
    @apply border-blue-500 text-blue-600 focus:text-blue-800 focus:border-blue-700;
  }
  .inactive {
    @apply border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:text-gray-700 focus:border-gray-300;
  }
  a {
    @apply mr-8 py-4 px-1 border-b-2 font-medium text-sm leading-5
        focus:outline-none capitalize;
  }
</style>
