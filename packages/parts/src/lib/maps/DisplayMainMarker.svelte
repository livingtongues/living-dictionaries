<script lang="ts">
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte';
  import Layer from './mapbox/map/Layer.svelte';
  import type { IDictionary } from '@living-dictionaries/types';
  import { dictionaryGeoJsonCollection } from './utils/dictionaryGeoJsonCollection';

  export let dictionary: Partial<IDictionary>;
</script>

<GeoJSONSource
  data={dictionaryGeoJsonCollection([dictionary])}>
  <Layer 
    options={{
      type: 'circle',
      paint: {
        'circle-color': 'blue',
        'circle-radius': 14,
      }
    }} />
</GeoJSONSource>