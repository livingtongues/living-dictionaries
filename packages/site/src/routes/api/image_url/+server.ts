import { PROCESS_IMAGE_URL } from '$env/static/private';
import { decodeToken } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ResponseCodes } from '$lib/constants';

export interface ImageUrlRequestBody {
  auth_token: string;
  firebase_storage_location: string;
}

export interface ImageUrlResponseBody {
  serving_url: string
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const { auth_token, firebase_storage_location } = await request.json() as ImageUrlRequestBody;

    const decodedToken = await decodeToken(auth_token);
    if (!decodedToken?.uid)
      throw new Error('No user id found in token');

    const processAndLocationUrl = `${PROCESS_IMAGE_URL}/${firebase_storage_location}`;

    const result = await fetch(processAndLocationUrl);
    const url = await result.text();
    if (!url)
      throw new Error('No serving url returned');
    const serving_url = url.replace('http://lh3.googleusercontent.com/', '').replace('\n', '');
    return json({serving_url} satisfies ImageUrlResponseBody);
  }
  catch (err: any) {
    console.error(`Photo processing error when getting serving url: ${err.message}`);
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Photo processing error when getting serving url: ${err.message}`);
  }
};
