<script lang="ts">
  import SvgGlobe from './SvgGlobe.svelte';




  interface Props {
    title: string;
    description: string;
    dictionaryName: string;
    lat?: number;
    lng?: number;
    height: number;
    width: number;
    gcsPath?: string;
  }

  let {
    title,
    description,
    dictionaryName,
    lat = undefined,
    lng = undefined,
    height,
    width,
    gcsPath = undefined
  }: Props = $props();
  let src = $derived(gcsPath ? `https://lh3.googleusercontent.com/${gcsPath}=w${width}-h${height}-c` : null);

  const MAX_TITLE_LENGTH = 90;
  const xPADDING = 48;
  const yPADDING = 36;

  let globeSize = $derived(src ? 200 : 400);
</script>

<!-- https://cssgradient.io/ is helpful with making gradients -->
<div
  style="
    display: flex;
    background-color: #6f8d9b;
    background-image: linear-gradient(to bottom, #6f8d9b, #546e7a);
    color: white;
    height: 100%;
    width: 100%;
    position: relative;
    padding: {yPADDING}px {xPADDING}px;
    {src ? 'text-shadow: 2px 2px 3px hsla(0, 0%, 0%, 40%);' : ''}
  ">
  {#if src}
    <img style="position: absolute; top:0; left:0; right: 0; bottom: 0;" alt="" {src} />
  {/if}
  <div
    style="
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
      height: 100%;
      font-weight: 400;
    ">
    {#if lat && lng}
      <div style="display: flex; position: absolute; bottom: 0; right: 0;">
        <SvgGlobe placeLatitude={lat} placeLongitude={lng} size={globeSize} />
      </div>
    {/if}
    {#if title}
      <div
        style="text-shadow: 2px 2px 3px hsla(0, 0%, 0%, 40%); font-size: {(title.length >
          MAX_TITLE_LENGTH / 2
          ? 3
          : 4) * 20}px;">
        {title.slice(0, MAX_TITLE_LENGTH)}{title.length > MAX_TITLE_LENGTH ? '...' : ''}
      </div>
    {/if}
    {#if description}
      <div
        style="overflow: hidden; flex-grow: 1; font-size: 30px; margin-top: 10px; margin-bottom: 20px; padding-right: {xPADDING +
          globeSize}px;">
        {description}
      </div>
    {/if}
    <div
      style="display: flex; align-items: center; font-size: 40px; padding-right: {xPADDING +
        globeSize}px;">
      <img
        style="height: 40px; width: 40px; margin-right: 10px;"
        alt="Living Dictionaries"
        src="https://livingdictionaries.app/images/LD_logo_white.svg" />
      <span>{dictionaryName} Living Dictionary </span>
    </div>
  </div>
</div>
