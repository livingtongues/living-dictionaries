<script lang="ts">
  // THROWAWAY: visual check of RecordAudio's no-audio-captured error state
  // (the real component's state needs a live mic). Delete after review.
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
</script>

<div class="wrapper">
  <div class="record-error">No audio was recorded. Please check that your microphone is connected and unmuted, then try again.</div>
  <HeadlessButton class="btn btn-default record-full record-tall">Tap to Record</HeadlessButton>
  <div class="record-hint">(Then you will tap to stop recording)</div>
</div>

<style>
  .wrapper {
    max-width: 22rem;
    padding: 1rem;
  }

  .record-error {
    color: var(--danger);
    font-size: 0.875rem;
    line-height: 1.35;
    text-align: center;
    margin-bottom: 0.5rem;
  }

  :global(.record-full) {
    width: 100%;
  }

  :global(.record-tall) {
    height: 6rem;
  }

  .record-hint {
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
    margin-top: 0.5rem;
  }
</style>
