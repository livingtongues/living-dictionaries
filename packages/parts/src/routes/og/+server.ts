import type { RequestHandler } from './$types';
import { componentToPng } from './componentToPng';
import LZString from 'lz-string';
const { decompressFromEncodedURIComponent: decode } = LZString;
import Image from './OpenGraphImage.svelte';

const HEIGHT = 628;
const WIDTH = 1200;

export const GET: RequestHandler = async ({ url }) => {
  const props = JSON.parse(decode(url.searchParams.get('props')));
  return componentToPng(Image, props, props.height || HEIGHT, props.width || WIDTH);
};
