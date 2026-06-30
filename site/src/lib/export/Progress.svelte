<script lang="ts">
  import { tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { page } from '$app/state'

  interface Props {
    progress?: number
  }

  const { progress = 0 }: Props = $props()
  const tweenedProgress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  })
  $effect(() => {
    tweenedProgress.set(progress)
  })
  const percentage = $derived(Math.floor($tweenedProgress * 100))
</script>

<div style="position: relative; padding-top: 0.25rem">
  <div class="progress-header">
    <div>
      <span class="downloading-pill">
        {page.data.t('misc.downloading')}
      </span>
    </div>
    <div style="text-align: right">
      <span class="progress-percent">
        {percentage}%
      </span>
    </div>
  </div>
  <div class="progress-track">
    <div
      style="width:{percentage}%"
      class="progress-bar"></div>
  </div>
</div>

<style>
  .progress-header {
    display: flex;
    margin-bottom: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  .downloading-pill {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    text-transform: uppercase;
    border-radius: 9999px;
    color: var(--primary);
    background-color: color-mix(in srgb, var(--primary) 18%, var(--background));
  }

  .progress-percent {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    display: inline-block;
    color: var(--primary);
  }

  .progress-track {
    overflow: hidden;
    height: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
    line-height: 1rem;
    display: flex;
    border-radius: 0.25rem;
    background-color: color-mix(in srgb, var(--primary) 18%, var(--background));
  }

  .progress-bar {
    box-shadow: none;
    display: flex;
    flex-direction: column;
    text-align: center;
    white-space: nowrap;
    color: var(--on-primary);
    justify-content: center;
    background-color: var(--primary);
  }
</style>
