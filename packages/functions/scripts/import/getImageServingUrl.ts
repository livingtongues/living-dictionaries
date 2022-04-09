import { fetchAsText } from 'fetch-as';
import 'dotenv/config'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

export const getImageServingUrl = async (imageStoragePath: string, environment: string) => {
  try {
    const storagePath = `${process.env.ProcessImageUrl}/talking-dictionaries-${
      environment == 'prod' ? 'alpha' : 'dev'
    }.appspot.com/${imageStoragePath}`;
    const imageServingUrl = await fetchAsText(storagePath);
    return imageServingUrl.data.replace('http://lh3.googleusercontent.com/', '');
  } catch (error) {
    console.log(`Error getting serving url for ${imageStoragePath} on ${environment}`);
    throw new Error(error);
  }
};
