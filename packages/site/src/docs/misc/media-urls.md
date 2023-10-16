# Media Urls for exporting

- Audio urls are made by taking the path string, converting `/` to `%2F` and then plugging the `convertedPath` into `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media` resulting in something like https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/audio/mandarin-practice/mogAtD3lTCtkuwj7tLDD_1630105846753.wav?alt=media for example. Remove the alt=media to get metadata.

- Photo urls are formed by the path and plugging it into `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media` to come up with something like https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/images%2Fmandarin-practice%2FmogAtD3lTCtkuwj7tLDD_1630105898118.jpg?alt=media
