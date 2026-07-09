# Map marker not showing on settings page

## Problem
Map markers missing on `/river/settings` (and in the Select Coordinates modal) despite valid coordinates like `-84.0833, 9.75`. Broken since Svelte 5 migration.

## Root cause
`Marker.svelte` decided "custom pin vs default Mapbox pin" with:

```ts
const customMarker = element.hasChildNodes()
```

In Svelte 5 the bound pin `<div>` can contain comment/whitespace nodes even when no `pin` snippet is passed. Mapbox then used that empty div as the marker element → **invisible marker** instead of the default colored SVG pin.

## Fixes
- ✅ `Marker.svelte`: use `!!pin` instead of `hasChildNodes()`; also `markers.delete` on cleanup
- ✅ `Map.svelte`: when token is missing/`dummy`, use a blank local style so `load` fires and children (markers) mount — needed for CSR svelte-look verification without a real token
- ✅ `CoordinatesModal.svelte` + `WhereSpoken.svelte`: truthiness→`!== undefined` for lat/lng (0,0 / Prime Meridian hardening; not river's bug)

## False leads (reverted / not the bug)
- Longitude being `0` — river coords were never 0
- `#each` object keys — reverted; wasn't why markers were invisible

## Verification
svelte-look CSR screenshots (blank local style, no Mapbox tiles):
- `CoordinatesModal` / `WithCoordinates` — black pin visible at center
- `WhereSpoken` / `RiverDictionaryCoordinates` (`-84.0833, 9.75`) — blue primary pin visible

## Status
- ✅ Root cause fixed + visually confirmed
- [ ] Deploy / confirm on production `/river/settings`
