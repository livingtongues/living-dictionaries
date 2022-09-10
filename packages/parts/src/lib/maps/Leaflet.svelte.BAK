<!-- <script lang="ts">
  import { onMount, createEventDispatcher, setContext } from "svelte";
  import { contextKey } from "./key.js";

  setContext(contextKey, {
    getMap: () => map,
    getLeaflet: () => leaflet
  });

  let container;
  let map;
  let leaflet;

  export let lat;
  export let lon;
  export let zoom;

  onMount(async () => {
    const leafletModule = await import("leaflet");
    leaflet = leafletModule.default;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.css";
    // link.integrity =
    //   "sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ==";
    // link.crossorigin = "";

    link.onload = () => {
      map = leaflet.map(container).setView([lat, lon], zoom + 1);
      leaflet
        .tileLayer("https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
          maxZoom: 18
        })
        .addTo(map);
    };

    document.head.appendChild(link);

    return () => {
      map.remove();
      link.parentNode.removeChild(link);
    };
  });
</script>

<div bind:this={container}>
  {#if map}
    <slot />
  {/if}
</div>

<style>
  div {
    flex: 1;
    width: 100%;
    height: 100%;
  }
</style> -->
