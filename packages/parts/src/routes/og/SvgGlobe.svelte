<script lang="ts">
  import { geoPath, geoOrthographic, geoGraticule10 } from 'd3-geo';
  import { feature } from 'topojson-client';
  import world from './land-110m.json';
  
  export let fill = '#6f8d9b';
  export let showGraticule = false;
  export let label: string = undefined;
  export let rotation = 0;
  export let placeLongitude = 10;
  export let placeLatitude = 30;
  export let size = 400;
  $: width = size;
  $: height = size;

  const MIN_LAT = -5;
  const MAX_LAT = 30;
  function clamp(num: number, min: number, max: number) {
    return num < min ? min : num > max ? max : num;
  }
  $: latitude = clamp(placeLatitude, MIN_LAT, MAX_LAT);
  $: longitude = placeLongitude;

  $: land = feature(world, world.objects.land);

  $: projection = geoOrthographic()
    .fitSize([width, height], land)
    .rotate([-longitude, -latitude, rotation]);
  $: path = geoPath(projection);
</script>

<svg {width} {height} viewBox="0 0 {width} {height}">
  <path fill="#efefef" d={path({ type: 'Sphere' })} />
  {#if showGraticule}
    <path d={path(geoGraticule10())} stroke="#ddd" fill="none" />
  {/if}
  <path {fill} d={path(land)} />
  <g text-anchor="middle" font-family="sans-serif" font-size="10">
    <g transform="translate({projection([placeLongitude, placeLatitude]).join(',')})">
      <path
        transform="translate(-12,-22)"
        fill="white"
        stroke={fill}
        stroke-width="1"
        d="M11.291 21.706L12 21l-.709.706zM12 21l.708.706a1 1 0 0 1-1.417 0l-.006-.007l-.017-.017l-.062-.063a47.708 47.708 0 0 1-1.04-1.106a49.562 49.562 0 0 1-2.456-2.908c-.892-1.15-1.804-2.45-2.497-3.734C4.535 12.612 4 11.248 4 10c0-4.539 3.592-8 8-8c4.408 0 8 3.461 8 8c0 1.248-.535 2.612-1.213 3.87c-.693 1.286-1.604 2.585-2.497 3.735a49.583 49.583 0 0 1-3.496 4.014l-.062.063l-.017.017l-.006.006L12 21zm0-8a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
      {#if label}
        <text fill="white" font-size="17" y="23">{label}</text>
      {/if}
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
<!-- Can add to transform attribute: scale(2) -->
<!-- Use to locate coordinate: <circle fill="black" r={1} /> -->
