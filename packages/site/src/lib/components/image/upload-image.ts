import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { firebaseConfig, authState } from 'sveltefirets';
import { get, writable, type Readable } from 'svelte/store';
import { user } from '$lib/stores';
import type { ImageUrlRequestBody, ImageUrlResponseBody } from '$api/image_url/+server';
import { post_request } from '$lib/client/get-post-requests';

export interface ImageUploadStatus {
  progress: number;
  preview_url: string;
  error?: string;
  storage_path?: string;
  serving_url?: string;
}

export function upload_image({file, folder}: {file: File, folder: string}): Readable<ImageUploadStatus> {
  const preview_url = URL.createObjectURL(file);
  const { set, subscribe } = writable<ImageUploadStatus>({ progress: 0, preview_url });

  const [file_type_including_period] = file.name.match(/\.[0-9a-z]+$/i);
  const storage_path = `${folder}/${new Date().getTime()}${file_type_including_period}`

  const $user = get(user);
  const customMetadata = {
    uploadedBy: $user.displayName,
    originalFileName: file.name,
  };

  // https://firebase.google.com/docs/storage/web/upload-files
  const storage = getStorage();
  const imageRef = ref(storage, storage_path);
  const uploadTask = uploadBytesResumable(imageRef, file, { customMetadata });

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const decimal_based_percentage = snapshot.bytesTransferred / snapshot.totalBytes;
      const progress = Math.floor(decimal_based_percentage * 100)
      console.info('Upload is ' + progress + '% done');
      set({preview_url, progress});

      switch (snapshot.state) {
      case 'paused':
        console.info('Upload is paused');
        break;
      case 'running':
        console.info('Upload is running');
        break;
      }
    },
    // https://firebase.google.com/docs/storage/web/handle-errors
    (err) => {
      console.error(err);
      set({preview_url, progress: 0, error: err.message});
    },
    async () => {
      const firebase_storage_location = `${firebaseConfig.storageBucket}/${storage_path}`;

      const auth_state_user = get(authState);
      const auth_token = await auth_state_user.getIdToken();
      const { data, error } = await post_request<ImageUrlRequestBody, ImageUrlResponseBody>({
        route: '/api/image_url',
        data: { auth_token, firebase_storage_location },
      });

      if (error) {
        console.error(error);
        set({preview_url, progress: 0, error: error.message});
      }

      if (data)
        set({preview_url, progress: 100, storage_path, serving_url: data.serving_url});
    }
  );

  return { subscribe }
}
