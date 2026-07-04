<script lang='ts'>
  import Button from '$lib/components/ui/Button.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import IconFaSolidTimes from '~icons/fa-solid/times'
</script>

<ShowHide>
  {#snippet children({ show: hide, toggle })}
    {#if !hide}
      <div class='notice-banner'>
        <div>
          <b>{page.data.t('banner.attention')}</b>: We are updating our website, and running into temporary login issues. Please bear with us as we return normal operations shortly.
        </div>
        <div class="banner-gap"></div>
        <Button form="simple" color="black" onclick={toggle}><IconFaSolidTimes class="icon-inline" /></Button>
      </div>
    {/if}
  {/snippet}
</ShowHide>

<style>
  .notice-banner {
    background-color: rgb(251 191 36); /* amber-400 */
    position: fixed;
    bottom: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    border-radius: 0.25rem;
    z-index: 99999;
    padding: 0.5rem;
    display: flex;
  }

  .banner-gap {
    width: 0.5rem;
    margin-left: auto;
    margin-right: auto;
  }
</style>
