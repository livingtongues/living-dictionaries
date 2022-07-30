import { loadScriptOnce, loadStylesOnce } from '../asset-loader';
import { bindEvents } from '../event-bindings.js';
import type { Map, MapboxOptions } from 'mapbox-gl';

export default function action(
  node: HTMLDivElement,
  options: { version?: string; customStylesheetUrl?: string } & MapboxOptions
) {
  let map: Map;

  const customStylesheetUrl = options.customStylesheetUrl;

  let unbind = () => {};
  (async () => {
    await loadScriptOnce(`//api.mapbox.com/mapbox-gl-js/${options.version}/mapbox-gl.js`);
    await loadStylesOnce(`//api.mapbox.com/mapbox-gl-js/${options.version}/mapbox-gl.css`);
    customStylesheetUrl && (await loadStylesOnce(customStylesheetUrl));
    unbind = init({ ...options, container: node }, node);
  })();

  return {
    destroy() {
      unbind();
      map && map.remove && map.remove();
    },
  };
}

function init(options: MapboxOptions, node: HTMLDivElement) {
  window.mapboxgl.accessToken = options.accessToken;
  const el = new window.mapboxgl.Map(options);

  return bindEvents(el, handlers, window.mapboxgl, node);
}

const handlers = {
  dragend: (el) => {
    return ['dragend', { center: el.getCenter() }];
  },
  drag: (el) => {
    return ['drag', { center: el.getCenter() }];
  },
  moveend: (el) => {
    return ['recentre', { center: el.getCenter() }];
  },
  click: (el, { lngLat }) => {
    return ['click', { lng: lngLat.lng, lat: lngLat.lat }];
  },
  zoomstart: (el) => {
    return ['zoomstart', { zoom: el.getZoom() }];
  },
  zoom: (el) => {
    return ['zoom', { zoom: el.getZoom() }];
  },
  zoomend: (el) => {
    return ['zoomend', { zoom: el.getZoom() }];
  },
  load: (el, ev, mapbox) => {
    return ['ready', { map: el, mapbox }];
  },
};
