<script lang="ts">
  import SvgGlobe from './SvgGlobe.svelte'

  interface Props {
    title: string
    description: string
    dictionaryName: string
    lat?: number
    lng?: number
    height: number
    width: number
    image_url?: string
    /**
     * Intrinsic pixel size of `image_url`, set by the `/og` route when it had to
     * transcode the photo: satori can measure a remote file but NOT a data URI,
     * and an unmeasurable image throws "Image size cannot be determined".
     */
    image_width?: number
    image_height?: number
  }

  const {
    title,
    description,
    dictionaryName,
    lat = undefined,
    lng = undefined,
    height,
    width,
    image_url = undefined,
    image_width = undefined,
    image_height = undefined,
  }: Props = $props()
  const src = $derived(image_url ?? null)
  const intrinsic_size = $derived(image_width && image_height ? { width: image_width, height: image_height } : {})

  const MAX_TITLE_LENGTH = 90
  const xPADDING = 48
  const yPADDING = 36

  const globeSize = $derived(src ? 200 : 400)
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
    <!-- Explicit px size, not 100%: satori resolves a percentage against the parent's
      CONTENT box, so the photo used to stop 96×72px short of the card edges. -->
    <img style="position: absolute; top:0; left:0; width: {width}px; height: {height}px; object-fit: cover;" alt="" {src} {...intrinsic_size} />
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
    {#if typeof lat === 'number' && typeof lng === 'number'}
      <div style="display: flex; position: absolute; bottom: 0; right: 0;">
        <SvgGlobe placeLatitude={lat} placeLongitude={lng} size={globeSize} />
      </div>
    {/if}
    {#if title}
      <div
        style="text-shadow: 2px 2px 3px hsla(0, 0%, 0%, 40%); font-size: {(title.length
          > MAX_TITLE_LENGTH / 2
          ? 3
          : 4) * 20}px;">
        {title.slice(0, MAX_TITLE_LENGTH)}{title.length > MAX_TITLE_LENGTH ? '...' : ''}
      </div>
    {/if}
    {#if description}
      <div
        style="overflow: hidden; flex-grow: 1; font-size: 30px; margin-top: 10px; margin-bottom: 20px; padding-right: {xPADDING
          + globeSize}px;">
        {description}
      </div>
    {/if}
    <div
      style="display: flex; align-items: center; font-size: 40px; padding-right: {xPADDING
        + globeSize}px;">
      <img
        style="height: 40px; width: 40px; margin-right: 10px;"
        alt="Living Dictionaries"
        src="https://livingdictionaries.app/images/LD_logo_white.svg" />
      <span>{dictionaryName} Living Dictionary </span>
    </div>
  </div>
</div>
