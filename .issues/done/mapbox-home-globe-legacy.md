---
title: Legacy Mapbox Globe Implementation on Home Page
type: docs
priority: 3
---

# Legacy Mapbox Home Page Globe Implementation

This document describes how the home page globe was implemented using Mapbox before being replaced with a Canvas-based D3 globe.

## Overview

The home page (`/packages/site/src/routes/+page.svelte`) used Mapbox GL JS with a globe projection to display dictionary locations worldwide.

## Components Used

### Map Component
```svelte
<Map 
  bind:this={mapComponent} 
  style="mapbox://styles/mapbox/light-v10?optimize=true" 
  zoom={2} 
  options={{ projection: 'globe' }} 
  lat={+user_latitude} 
  lng={+user_longitude}
>
```

- `$lib/components/maps/mapbox/map/Map.svelte` - Main map wrapper
- Initial center based on user's geolocation (from Vercel headers)
- Globe projection enabled via `options={{ projection: 'globe' }}`

### Dictionary Points
```svelte
<DictionaryPoints dictionaries={public_dictionaries} bind:selectedDictionaryId />
<DictionaryPoints dictionaries={$my_dictionaries} type="personal" bind:selectedDictionaryId />
<DictionaryPoints dictionaries={private_dictionaries} type="private" bind:selectedDictionaryId />
```

- `$lib/components/home/DictionaryPoints.svelte` - Renders clustered dictionary points
- Used Mapbox GeoJSONSource with clustering enabled
- Three layers: public, personal (user's dictionaries), and private (admin only)
- Clicking a cluster zooms in; clicking a point selects the dictionary

### Selected Dictionary Display
When a dictionary was selected:
```svelte
{#if selectedDictionary?.coordinates}
  {#if selectedDictionary.coordinates.points}
    {#each selectedDictionary.coordinates.points as point, index}
      <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude} 
              color={index === 0 ? 'blue' : 'black'} />
    {/each}
  {/if}
  {#if selectedDictionary.coordinates.regions}
    {#each selectedDictionary.coordinates.regions as region}
      <Region {region} />
    {/each}
  {/if}
{/if}
```

- `$lib/components/maps/mapbox/map/Marker.svelte` - Individual point markers
- `$lib/components/maps/mapbox/map/Region.svelte` - GeoJSON region polygons
- First point shown in blue, additional points in black
- Regions rendered as filled polygons

### Controls
```svelte
<NavigationControl position="bottom-right" showCompass={false} />
<ToggleStyle />
```

- Navigation controls (zoom buttons)
- Style toggle (satellite/street view)

### Admin Features
```svelte
{#if $admin}
  <ShowHide>
    <CustomControl position="bottom-right">
      <button>Toggle Private</button>
    </CustomControl>
    {#if show && private_dictionaries.length}
      <DictionaryPoints dictionaries={private_dictionaries} type="private" />
    {/if}
  </ShowHide>
{/if}
```

- Admins could toggle visibility of private dictionaries
- Private dictionaries shown with different styling (black, smaller)

## setCurrentDictionary Function

```javascript
function setCurrentDictionary(dictionary: DictionaryView) {
  selectedDictionaryId = dictionary.id
  if (dictionary.coordinates?.points?.[0]) {
    const [point] = dictionary.coordinates.points
    mapComponent.setZoom(7)
    mapComponent.setCenter([point.coordinates.longitude, point.coordinates.latitude])
  }
}
```

- Called when user selects a dictionary from sidebar search or featured list
- Zooms to level 7 and centers on the dictionary's first coordinate point

## Features NOT Ported to Canvas Globe

1. **Region polygons**: Selected dictionaries could display GeoJSON region boundaries. The canvas globe only shows point markers.

2. **Multiple markers for selected dictionary**: Dictionaries with multiple coordinate points showed all points (first blue, others black). Canvas globe only highlights the primary point.

3. **Clustering with counts**: Mapbox automatically clustered nearby points and showed counts. Canvas globe uses force-directed label placement instead.

4. **Navigation controls**: Zoom +/- buttons and style toggle removed.

5. **Satellite/street toggle**: Style switching not applicable to canvas globe.

## Related Files (still in use for other pages)

These Mapbox components remain in the codebase for use on other pages:
- `$lib/components/maps/mapbox/map/Map.svelte`
- `$lib/components/maps/mapbox/map/Marker.svelte`
- `$lib/components/maps/mapbox/map/Layer.svelte`
- `$lib/components/maps/mapbox/map/Region.svelte`
- `$lib/components/maps/mapbox/sources/GeoJSONSource.svelte`
- `$lib/components/maps/mapbox/controls/NavigationControl.svelte`
- `$lib/components/maps/mapbox/controls/ToggleStyle.svelte`
- `$lib/components/maps/mapbox/controls/CustomControl.svelte`
