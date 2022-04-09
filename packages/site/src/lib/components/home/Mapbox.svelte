<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { contextKey } from '$lib/components/home/key';

  interface ILatLonZoom {
    lat: number;
    lon: number;
    zoom: number;
  }

  setContext(contextKey, {
    getMap: () => map,
    getMapbox: () => mapbox,
  });

  let container: HTMLElement;
  let map: mapboxgl.Map;
  let mapbox: typeof import('mapbox-gl');

  let lat = 10;
  let lon = -80;
  let zoom = 2;
  let style = 'mapbox://styles/mapbox/light-v10?optimize=true'; // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11

  onMount(async () => {
    ({ lat, lon, zoom } = getCachedIPLocation(lat, lon, zoom));
    // await new Promise((resolve) => setTimeout(resolve, 500));
    const mapboxModule = await import('mapbox-gl');
    mapbox = mapboxModule.default;
    mapbox.accessToken = import.meta.env.VITE_mapboxAccessToken as string;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v1.9.1/mapbox-gl.css';

    link.onload = () => {
      const tempMap = new mapbox.Map({
        container,
        style,
        zoom,
        center: [lon, lat],
      });
      tempMap.addControl(new mapbox.NavigationControl({ showCompass: false }), 'bottom-right');
      // el.addControl(new mapbox.GeolocateControl(), "bottom-right");

      // el.on("dragend", () => dispatch("recentre", { center: el.getCenter() }));

      tempMap.on('load', () => {
        map = tempMap;
        fetchIPLocation();
      });
    };

    document.head.appendChild(link);

    return () => {
      map.remove();
      link.parentNode.removeChild(link);
    };
  });

  import { session } from '$app/stores';

  async function fetchIPLocation() {
    try {
      if ($session.ip) {
        const url = $session.ip.replace(/,.*/, '');
        const res = await fetch(`https://freegeoip.app/json/${url}`);
        if (res.ok) {
          const data = await res.json();
          if (data.longitude && data.latitude) {
            lat = data.latitude;
            lon = data.longitude;
            zoom = 4;
            map.flyTo({ center: [lon, lat], zoom, duration: 1000 });
            localStorage.setItem('ip_location', JSON.stringify({ lat, lon }));
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  }

  function getCachedIPLocation(lat: number, lon: number, zoom: number): ILatLonZoom {
    const cachedLatLonZoom: { lat: number; lon: number } = JSON.parse(
      localStorage.getItem('ip_location')
    );
    return (
      (cachedLatLonZoom &&
        cachedLatLonZoom.lat &&
        cachedLatLonZoom.lon && {
          zoom: 4,
          lat: cachedLatLonZoom.lat,
          lon: cachedLatLonZoom.lon,
        }) || {
        lat,
        lon,
        zoom,
      }
    );
  }

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === 'Mapbox Light') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v11'); // satellite-v9
    } else {
      map.setStyle('mapbox://styles/mapbox/light-v10?optimize=true');
    }
  }

  let height: number;
  $: {
    if (height) {
      map && map.resize();
    }
  }
</script>

<slot name="sidebar" />
<div class="relative flex-1" bind:this={container} bind:clientHeight={height}>
  {#if map}
    <!--if there is a map then add the dictionaries-->
    <slot />
  {:else}
    <div class="w-full h-full bg-gray-100 flex items-center justify-center">
      <i class="fad fa-globe-asia text-6xl text-gray-400 animate-pulse" />
    </div>
  {/if}

  <button
    type="button"
    on:click={toggleStyle}
    class="px-2 py-1 absolute rounded shadow bg-white"
    style="bottom: 40px; left: 8px; z-index: 1;">
    <i class="far fa-globe-asia" />
  </button>
</div>
