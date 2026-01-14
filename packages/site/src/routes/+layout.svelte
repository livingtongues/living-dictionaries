<!-- @migration task: review uses of `navigating` -->
<script lang="ts">
  import { browser } from '$app/environment'
  import { navigating, page } from '$app/state'
  import LoadingIndicator from './LoadingIndicator.svelte'
  import './global.css'

  interface Props {
    children?: import('svelte').Snippet
  }

  let { children }: Props = $props()

// export let data
  // $: ({ user } = data)
</script>

{#if browser}
  {#if navigating}
    <LoadingIndicator />
  {/if}

  {#await import('./PromptReloadOnUpdate.svelte') then { default: PromptReloadOnUpdate }}
    <PromptReloadOnUpdate />
  {/await}

  {#await import('$lib/components/ui/Toasts.svelte') then { default: Toasts }}
    <Toasts />
  {/await}
{/if}

<!-- {#if $user}
  {#await import('./Banner.svelte') then { default: Banner }}
    <Banner />
  {/await}
{/if} -->

<div id="direction" dir={page.data.t('page.direction') as 'ltr' | 'rtl' | 'auto'}>
  {@render children?.()}
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
