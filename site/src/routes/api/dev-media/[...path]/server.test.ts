import { posix, win32 } from 'node:path'
import { path_is_within_root } from './path-boundary'

describe(path_is_within_root, () => {
  test.each([
    { platform: 'POSIX', path_api: posix, root: '/tmp/data/dev-media' },
    { platform: 'Windows', path_api: win32, root: String.raw`C:\data\dev-media` },
  ])('$platform paths enforce the root boundary', ({ path_api, root }) => {
    expect(path_is_within_root({
      root,
      full: path_api.join(root, 'dictionary', 'photo', 'image.webp'),
      separator: path_api.sep,
    })).toBeTruthy()
    expect(path_is_within_root({
      root,
      full: path_api.join(root, '..', 'outside.webp'),
      separator: path_api.sep,
    })).toBeFalsy()
    expect(path_is_within_root({
      root,
      full: `${root}-other${path_api.sep}image.webp`,
      separator: path_api.sep,
    })).toBeFalsy()
  })
})
