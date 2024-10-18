<script lang='ts'>
  import { page } from '$app/stores'

  let hide_message = false
</script>

<div class:hidden={hide_message} class='bg-amber-400 pl-4 sticky top-0 z-20 md:text-sm text-xs w-full py-1'>
  <span class="cursor-pointer" on:click={() => hide_message = true}>&times;</span>
  {$page.data.t('banner.attention')}: <strong>{$page.data.t('banner.message')}</strong></div>
