# Mapbox → D3 Globe

The home page globe was replaced from Mapbox GL JS to a Canvas-based D3 globe.

## Legacy Mapbox Implementation
- Used `mapbox://styles/mapbox/light-v10` with `projection: 'globe'`
- Initial center from user geolocation (Vercel headers)
- Markers clustered with `mapbox-gl` cluster sources
- Required Mapbox API key and ~200KB library

## Why Replaced
Canvas-based D3 globe is lighter, has no API key dependency, and gives more visual control for the dictionary-location visualization on the landing page.
