<script lang="ts">
  interface Props {
    lat: number;
    lng: number;
  }

  let { lat, lng }: Props = $props();
</script>

{#if lat && lng}
  {lat}°
  {lat < 0 ? 'S' : 'N'},
  {lng}°
  {lng < 0 ? 'W' : 'E'}
{/if}
