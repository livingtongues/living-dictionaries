import type { RequestHandler } from './$types';
import { componentToPng } from './componentToPng';
import {
  decompressFromEncodedURIComponent as decode,
} from 'lz-string';
import Image from './OpenGraphImage.svelte';

const HEIGHT = 600;
const WIDTH = 1200;

export const GET: RequestHandler = async ({ url }) => {
  const props = JSON.parse(decode(url.searchParams.get('props')));
  return componentToPng(Image, props, props.height || HEIGHT, props.width || WIDTH);
};
