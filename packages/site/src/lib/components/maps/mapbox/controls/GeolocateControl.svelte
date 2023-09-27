<script lang="ts">
  import { getContext, onMount, createEventDispatcher } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import { bindEvents } from '../event-bindings';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let options = {};

  const geolocate = new mapbox.GeolocateControl(options);
  map.addControl(geolocate, position);

  const dispatch = createEventDispatcher<{
    geolocate: any;
    outofmaxbounds: any;
    trackuserlocationstart: any;
    trackuserlocationend: any;
    error: any;
  }>();
  const handlers: Record<string, any> = {
    geolocate: (e) => dispatch('geolocate', e),
    outofmaxbounds: (e) => dispatch('outofmaxbounds', e),
    trackuserlocationstart: (e) => dispatch('trackuserlocationstart', e),
    trackuserlocationend: (e) => dispatch('trackuserlocationend', e),
    error: (e) => dispatch('error', e),
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
