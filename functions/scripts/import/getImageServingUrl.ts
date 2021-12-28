import { fetchAsText } from 'fetch-as';
const p = 'anet';
const processImageUrl = `https://${p}-photo.appspot.com/urlfull`;

export const getImageServingUrl = async (imageStoragePath: string, environment: string) => {
  try {
    const storagePath = `${processImageUrl}/talking-dictionaries-${
      environment == 'prod' ? 'alpha' : 'dev'
    }.appspot.com/${imageStoragePath}`;
    const imageServingUrl = await fetchAsText(storagePath);
    return imageServingUrl.data.replace('http://lh3.googleusercontent.com/', '');
  } catch (error) {
    console.log(`Error getting serving url for ${imageStoragePath} on ${environment}`);
    throw new Error(error);
  }
};
