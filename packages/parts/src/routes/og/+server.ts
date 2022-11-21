import Image from './OpenGraphImage.svelte';
import type { RequestHandler } from './$types';
import { componentToPng } from './componentToPng';

const HEIGHT = 600;
const WIDTH = 1200;

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams;
  
  const height = query.get('h') ?? HEIGHT;
  const width = query.get('w') ?? WIDTH;

  const title = query.get('ti') ?? '';
  const description = query.get('desc') ?? '';
  const dictionaryName = query.get('dict') ?? '';
  const gcsPath = query.get('gcsPath') ?? '';

  return componentToPng(Image, { title, description, dictionaryName, gcsPath, height: +height, width: +width }, +height, +width);
};
