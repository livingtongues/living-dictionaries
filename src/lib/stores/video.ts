import { derived } from 'svelte/store';
import { admin } from './admin';
import { dictionary } from './dictionary';

const dictionariesTestingVideo = ['tutelo-saponi', 'kalanga', 'san-sebastian-del-monte-m', 'sora'];

export const videoAccess = derived([admin, dictionary], ([$admin, $dictionary]) => {
  if ($admin) {
    return true;
  }
  if ($dictionary) {
    return !!dictionariesTestingVideo.includes($dictionary.id);
  } else {
    return false;
  }
});
