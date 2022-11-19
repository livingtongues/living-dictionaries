<script lang="ts">
  import SvgGlobe from './SvgGlobe.svelte';

  export let title: string;
  export let description: string;

  export let dictionaryName: string;
  export let lat: number = undefined;
  export let lng: number = undefined;

  export let height: number;
  export let width: number;

  export let gcsPath: string = undefined;
  $: src = gcsPath ? `https://lh3.googleusercontent.com/${gcsPath}=w${width}-h${height}-c` : null;

  const MAX_TITLE_LENGTH = 80;
  const PADDING = 16;

  $: globeSize = src ? 100 : 200;
</script>

<div
  style="
        display: flex;
        background-image: linear-gradient(to bottom, #6f8d9b, #546e7a);
        color: white;
        height: 100%;
        width: 100%;
        padding: {PADDING}px;
        position: relative;
        line-height: 1.2;
    ">
  {#if src}
    <img style="position: absolute; top:0; left:0; right: 0; bottom: 0;" alt="" {src} />
    <div
      style="
        display: flex;
        background-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 15%, rgba(0,0,0,0) 85%, rgba(0,0,0,1) 100%);
        height: 100%;
        width: 100%;
        position: absolute; top:0; left:0; right: 0; bottom: 0;
    " />
  {/if}
  <div style="display: flex; flex-direction: column; position: relative; width: 100%;">
    {#if lat && lng}
      <div style="display: flex; position: absolute; bottom: 0; right: 0;">
        <SvgGlobe placeLatitude={lat} placeLongitude={lng} size={globeSize} />
      </div>
    {/if}
    <div style="display: flex; font-size: {title.length > MAX_TITLE_LENGTH / 2 ? 2 : 4}rem;">
      {title.slice(0, MAX_TITLE_LENGTH)}{title.length > MAX_TITLE_LENGTH ? '...' : ''}
    </div>
    <div
      style="display: flex; font-size: 1.5rem; margin-top: 10px; color: #ededed; padding-right: {PADDING + globeSize}px;">
      {description}
    </div>
    <div style="display: flex; align-items: center; position: absolute; bottom: 0; left: 0;">
      <img
        style="height: 20px; width: 20px; margin-right: 5px;"
        alt="Living Dictionaries"
        src="https://livingdictionaries.app/images/LD_logo_white.svg" />
      <span class="font-size: 16px;"> {dictionaryName} Living Dictionary </span>
    </div>
  </div>
</div>

<!-- hsla(198, 14%, 20%, 1) -->
