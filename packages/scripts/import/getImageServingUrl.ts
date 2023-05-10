import fetch from 'node-fetch';

import 'dotenv/config'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

export const getImageServingUrl = async (imageStoragePath: string, environment: string) => {
  if (!process.env.ProcessImageUrl)
    throw new Error('Missing ProcessImageUrl, is it in your uncommitted .env file?');

  try {
    const imageServingUrlEndpoint = `${process.env.ProcessImageUrl}/talking-dictionaries-${
      environment == 'prod' ? 'alpha' : 'dev'
    }.appspot.com/${imageStoragePath}`;
    const res = await fetch(imageServingUrlEndpoint);
    const imageServingUrl = await res.text();
    return imageServingUrl.replace('http://lh3.googleusercontent.com/', '');
  } catch (error) {
    console.log(`Error getting serving url for ${imageStoragePath} on ${environment}`);
    // @ts-ignore
    throw new Error(error);
  }
};
