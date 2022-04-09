import { fetchAsText } from 'fetch-as';

export const getImageServingUrl = async (imageStoragePath: string, environment: string) => {
  try {
    const storagePath = `${processImageUrl}/talking-dictionaries-${environment}.appspot.com/${imageStoragePath}`;
    const imageServingUrl = await fetchAsText(storagePath);
    return imageServingUrl.data.replace('http://lh3.googleusercontent.com/', '');
  } catch (error) {
    console.log(`Error getting serving url for ${imageStoragePath} on ${environment}`);
    throw new Error(error);
  }
};
