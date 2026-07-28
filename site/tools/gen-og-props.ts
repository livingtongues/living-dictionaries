import { compressToEncodedURIComponent as encode } from '../src/lib/lz/lz-string'

const props = { title: 'Sunflower', description: 'A tall plant with a large yellow flower head, native to the Americas', dictionaryName: 'Tutelo-Saponi', lat: 36.5, lng: -79.1, width: 1200, height: 630 }
process.stdout.write(encodeURIComponent(encode(JSON.stringify(props))))
