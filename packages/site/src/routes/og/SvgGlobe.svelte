<script lang="ts">
  import { geoPath, geoOrthographic, geoGraticule10 } from 'd3-geo';
  import { feature } from 'topojson-client';
  import world from './land-110m.json';

  interface Props {
    fill?: string; // '#999';
    showGraticule?: boolean;
    label?: string;
    rotation?: number;
    placeLongitude?: number;
    placeLatitude?: number;
    size?: number;
  }

  let {
    fill = '#6f8d9b',
    showGraticule = false,
    label = undefined,
    rotation = 0,
    placeLongitude = 10,
    placeLatitude = 30,
    size = 400
  }: Props = $props();
  let width = $derived(size);
  let height = $derived(size);

  const MIN_LAT = -5;
  const MAX_LAT = 30;
  function clamp(num: number, min: number, max: number) {
    return num < min ? min : num > max ? max : num;
  }
  let latitude = $derived(clamp(placeLatitude, MIN_LAT, MAX_LAT));
  let longitude = $derived(placeLongitude);

  let land = $derived(feature(world, world.objects.land));

  let projection = $derived(geoOrthographic()
    .fitSize([width, height - size * 0.06], land)
    .rotate([-longitude, -latitude, rotation]));
  let path = $derived(geoPath(projection));
</script>

<svg {width} {height} viewBox="0 0 {width} {height}">
  <defs>
    <radialGradient id="drop_shadow" cx="50%" cy="50%">
      <stop offset="20%" stop-color="#000" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#000" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="ocean_fill" cx="75%" cy="25%">
      <stop offset="5%" stop-color="#fff" />
      <stop offset="100%" stop-color="#ededed" />
    </radialGradient>

    <radialGradient id="globe_highlight" cx="75%" cy="25%">
      <stop offset="5%" stop-color="#ffd" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#ba9" stop-opacity="0.2" />
    </radialGradient>

    <radialGradient id="globe_shading" cx="55%" cy="45%">
      <stop offset="30%" stop-color="#fff" stop-opacity="0" />
      <stop offset="100%" stop-color="#505962" stop-opacity="0.3" />
    </radialGradient>
  </defs>

  <g transform="translate(0, {size * 0.01})">
    <ellipse cx="45%" cy="93%" rx="45%" ry="6%" fill="url(#drop_shadow)" />

    <path fill="url(#ocean_fill)" d={path({ type: 'Sphere' })} />

    {#if showGraticule}
      <path d={path(geoGraticule10())} stroke="#ddd" fill="none" />
    {/if}

    <path {fill} d={path(land)} />
    <path fill="url(#globe_highlight)" d={path({ type: 'Sphere' })} />
    <path fill="url(#globe_shading)" d={path({ type: 'Sphere' })} />

    <g text-anchor="middle">
      <g transform="translate({projection([placeLongitude, placeLatitude]).join(',')})">
        <ellipse transform="translate(0, 1)" rx="6" ry="3" fill="url(#drop_shadow)" />
        <path
          style="filter: drop-shadow(1px 1px 1px rgb(0 0 0 / 0.4))"
          transform="translate(-18,-32) scale(1.5)"
          fill="white"
          stroke-width="1"
          d="M11.291 21.706L12 21l-.709.706zM12 21l.708.706a1 1 0 0 1-1.417 0l-.006-.007l-.017-.017l-.062-.063a47.708 47.708 0 0 1-1.04-1.106a49.562 49.562 0 0 1-2.456-2.908c-.892-1.15-1.804-2.45-2.497-3.734C4.535 12.612 4 11.248 4 10c0-4.539 3.592-8 8-8c4.408 0 8 3.461 8 8c0 1.248-.535 2.612-1.213 3.87c-.693 1.286-1.604 2.585-2.497 3.735a49.583 49.583 0 0 1-3.496 4.014l-.062.063l-.017.017l-.006.006L12 21zm0-8a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
        <!-- <circle fill="black" r={1} /> -->

        {#if label}
          <text fill="white" font-family="sans-serif" font-size="17" y="23">{label}</text>
        {/if}
      </g>
    </g>
  </g>
</svg>

<!-- <g>
  {#each countries as country}
    <path
      d={path(country.geometry)}
      fill={country.properties.fill}
      stroke={country.properties.stroke} />
  {/each}
</g> -->
