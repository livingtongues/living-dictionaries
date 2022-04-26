<script lang="ts">
  export let lat: number, lng: number;
</script>

{#if lat && lng}
  {lat}°
  {lat < 0 ? 'S' : 'N'},
  {lng}°
  {lng < 0 ? 'W' : 'E'}
{/if}
