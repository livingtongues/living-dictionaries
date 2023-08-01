import { PROCESS_IMAGE_URL } from '$env/static/private';
import { decodeToken } from '$lib/server/firebase-admin';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface ImageUrlRequestBody {
  auth_token: string;
  firebase_storage_location: string;
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
    const gcsPath = url.replace('http://lh3.googleusercontent.com/', '').replace('\n', '');
    return json(gcsPath);
  }
  catch (err: any) {
    console.error(`Photo processing error when getting serving url: ${err.message}`);
    throw error(500, `Photo processing error when getting serving url: ${err.message}`);
  }
};
