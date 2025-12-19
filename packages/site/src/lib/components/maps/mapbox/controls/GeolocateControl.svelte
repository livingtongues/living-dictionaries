<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import { bindEvents } from '../event-bindings';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
    options?: any;
    on_geolocate?: (e: any) => void;
    on_outofmaxbounds?: (e: any) => void;
    on_trackuserlocationstart?: (e: any) => void;
    on_trackuserlocationend?: (e: any) => void;
    on_error?: (e: any) => void;
  }

  let { position = 'top-right', options = {}, on_geolocate, on_outofmaxbounds, on_trackuserlocationstart, on_trackuserlocationend, on_error }: Props = $props();

  const geolocate = new mapbox.GeolocateControl(options);
  map.addControl(geolocate, position);

  const handlers: Record<string, any> = {
    geolocate: (e) => on_geolocate?.(e),
    outofmaxbounds: (e) => on_outofmaxbounds?.(e),
    trackuserlocationstart: (e) => on_trackuserlocationstart?.(e),
    trackuserlocationend: (e) => on_trackuserlocationend?.(e),
    error: (e) => on_error?.(e),
  };

  onMount(() => {
    const unbind = bindEvents(geolocate, handlers);
    return () => {
      unbind();
      map?.removeControl(geolocate);
    };
  });

  export function trigger() {
    geolocate.trigger();
  }
</script>
