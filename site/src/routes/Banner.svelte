<script lang='ts'>
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'
</script>

<ShowHide let:show={hide} let:toggle>
  {#if !hide}
    <div class='bg-amber-400 fixed bottom-3 left-3 right-3 rounded z-99999 p-2 flex'>
      <div>
        <b>{$page.data.t('banner.attention')}</b>: We are updating our website, and running into temporary login issues. Please bear with us as we return normal operations shortly.
      </div>
      <div class="w-2 mx-auto"></div>
      <Button form="simple" color="black" onclick={toggle}><span class="i-fa-solid-times" /></Button>
    </div>
  {/if}
</ShowHide>
