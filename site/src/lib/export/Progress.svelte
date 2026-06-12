<script lang="ts">
  import { run } from 'svelte/legacy'

  import { tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { page } from '$app/stores'

  interface Props {
    progress?: number
  }

  const { progress = 0 }: Props = $props()
  const tweenedProgress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  })
  run(() => {
    tweenedProgress.set(progress)
  })
  const percentage = $derived(Math.floor($tweenedProgress * 100))
</script>

<div style="position: relative; padding-top: 0.25rem">
  <div class="progress-header">
    <div>
      <span class="downloading-pill">
        {$page.data.t('misc.downloading')}
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
    color: rgb(37 99 235); /* blue-600 */
    background-color: rgb(191 219 254); /* blue-200 */
  }

  .progress-percent {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    display: inline-block;
    color: rgb(37 99 235); /* blue-600 */
  }

  .progress-track {
    overflow: hidden;
    height: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
    line-height: 1rem;
    display: flex;
    border-radius: 0.25rem;
    background-color: rgb(191 219 254); /* blue-200 */
  }

  .progress-bar {
    box-shadow: none;
    display: flex;
    flex-direction: column;
    text-align: center;
    white-space: nowrap;
    color: #fff;
    justify-content: center;
    background-color: rgb(59 130 246); /* blue-500 */
  }
</style>
