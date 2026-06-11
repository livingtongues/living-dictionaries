// @ts-nocheck
/* eslint-disable */
//
// Single-owner OPFS VFS for wa-sqlite — derived from wa-sqlite's example
// `OriginPrivateFileSystemVFS.js` (Copyright 2022 Roy T. Hashimoto) but adapted
// for our leader-elected dedicated-worker topology.
//
// WHY A CUSTOM VFS (see the repo's opfs-leader-worker knowledge page):
//   - The stock example only grabs a FileSystemSyncAccessHandle while holding a
//     SQLite EXCLUSIVE lock and releases it on unlock, so READS fall back to a
//     slow async `getFile()` + blob-slice per page. That's unacceptable for the
//     read-heavy viewer + Orama and won't scale to LD-size data.
//   - Because our `navigator.locks` leader election guarantees EXACTLY ONE owner
//     of the file across the whole origin, we can safely hold the access handle
//     for the lifetime of the open connection. That gives:
//       * fast ~1x in-place reads AND writes (no IndexedDB/LevelDB write-amp),
//       * a real OPFS path, so the viewer can drop in a downloaded snapshot .db.
//   - Single owner ⇒ no cross-context SQLite locking needed ⇒ xLock/xUnlock are
//     no-ops (the held SAH already gives us exclusive OS-level access).
//
// Used with the Asyncify build (`wa-sqlite-async.mjs`): only the genuinely
// async methods (open/close/access/delete) suspend via `handleAsync`; the hot
// path (read/write/sync/filesize/truncate) is fully synchronous against the
// held SAH.
//
// This file is `.js` + `@ts-nocheck` on purpose: it implements wa-sqlite's
// untyped VFS interface (mandated camelCase `xOpen`/`xRead`/… method names) and
// mirrors vendored example code. Keep it dumb and faithful.

import * as VFS from 'wa-sqlite/src/VFS.js'

const BLOCK_SIZE = 4096

/** @type {Map<string, FileSystemDirectoryHandle>} */
const DIRECTORY_CACHE = new Map()

export class OpfsSingleOwnerVFS extends VFS.Base {
  #vfsName
  #root = null
  #rootReady = navigator.storage.getDirectory().then((handle) => {
    this.#root = handle
    return handle
  })

  /** @type {Map<number, { filename: string, flags: number, fileHandle: any, accessHandle: any }>} */
  #mapIdToFile = new Map()

  constructor(vfsName) {
    super()
    this.#vfsName = vfsName || 'opfs-single-owner'
    // Our DB paths can exceed the base class's tiny default (64).
    this.mxPathName = 512
  }

  get name() {
    return this.#vfsName
  }

  async close() {
    for (const fileId of [...this.#mapIdToFile.keys()]) {
      await this.xClose(fileId)
    }
  }

  xOpen(name, fileId, flags, pOutFlags) {
    return this.handleAsync(async () => {
      if (name === null)
        name = `null_${fileId}`
      try {
        const url = new URL(name, 'file://localhost/')
        const create = (flags & VFS.SQLITE_OPEN_CREATE) ? true : false
        const [directoryHandle, filename] = await this.#getPathComponents(url, create)
        const fileHandle = await directoryHandle.getFileHandle(filename, { create })

        // Single owner ⇒ hold the access handle for the whole open lifetime.
        const accessHandle = await fileHandle.createSyncAccessHandle()

        this.#mapIdToFile.set(fileId, {
          filename: url.pathname,
          flags,
          fileHandle,
          accessHandle,
        })
        pOutFlags.setInt32(0, flags, true)
        return VFS.SQLITE_OK
      } catch (e) {
        console.error(`[${this.#vfsName}] xOpen failed:`, e?.message || e)
        return VFS.SQLITE_CANTOPEN
      }
    })
  }

  xClose(fileId) {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId)
      if (file) {
        this.#mapIdToFile.delete(fileId)
        try { file.accessHandle.flush() } catch { /* ignore */ }
        try { await file.accessHandle.close() } catch { /* ignore */ }
        if (file.flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
          try {
            const [directoryHandle, filename] = await this.#getPathComponents(file.filename, false)
            await directoryHandle.removeEntry(filename)
          } catch { /* ignore */ }
        }
      }
      return VFS.SQLITE_OK
    })
  }

  // ── hot path: synchronous against the held SAH ───────────────────────────

  xRead(fileId, pData, iOffset) {
    const file = this.#mapIdToFile.get(fileId)
    const nBytesRead = file.accessHandle.read(pData, { at: iOffset })
    if (nBytesRead < pData.byteLength) {
      pData.fill(0, nBytesRead, pData.byteLength)
      return VFS.SQLITE_IOERR_SHORT_READ
    }
    return VFS.SQLITE_OK
  }

  xWrite(fileId, pData, iOffset) {
    const file = this.#mapIdToFile.get(fileId)
    const nBytes = file.accessHandle.write(pData, { at: iOffset })
    return nBytes === pData.byteLength ? VFS.SQLITE_OK : VFS.SQLITE_IOERR
  }

  xTruncate(fileId, iSize) {
    const file = this.#mapIdToFile.get(fileId)
    file.accessHandle.truncate(iSize)
    return VFS.SQLITE_OK
  }

  xSync(fileId, flags) {
    const file = this.#mapIdToFile.get(fileId)
    file.accessHandle.flush()
    return VFS.SQLITE_OK
  }

  xFileSize(fileId, pSize64) {
    const file = this.#mapIdToFile.get(fileId)
    const size = file.accessHandle.getSize()
    pSize64.setBigInt64(0, BigInt(size), true)
    return VFS.SQLITE_OK
  }

  // ── single owner ⇒ locking is a no-op ────────────────────────────────────

  xLock(fileId, flags) {
    return VFS.SQLITE_OK
  }

  xUnlock(fileId, flags) {
    return VFS.SQLITE_OK
  }

  xCheckReservedLock(fileId, pResOut) {
    pResOut.setInt32(0, 0, true)
    return VFS.SQLITE_OK
  }

  xSectorSize(fileId) {
    return BLOCK_SIZE
  }

  xDeviceCharacteristics(fileId) {
    return VFS.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
  }

  xAccess(name, flags, pResOut) {
    return this.handleAsync(async () => {
      try {
        const [directoryHandle, filename] = await this.#getPathComponents(name, false)
        await directoryHandle.getFileHandle(filename, { create: false })
        pResOut.setInt32(0, 1, true)
      } catch {
        pResOut.setInt32(0, 0, true)
      }
      return VFS.SQLITE_OK
    })
  }

  xDelete(name, syncDir) {
    return this.handleAsync(async () => {
      try {
        const [directoryHandle, filename] = await this.#getPathComponents(name, false)
        await directoryHandle.removeEntry(filename)
      } catch { /* ignore — deleting a non-existent file is fine */ }
      return VFS.SQLITE_OK
    })
  }

  /**
   * @param {string|URL} nameOrURL
   * @param {boolean} create
   * @returns {Promise<[FileSystemDirectoryHandle, string]>}
   */
  async #getPathComponents(nameOrURL, create) {
    const url = typeof nameOrURL === 'string'
      ? new URL(nameOrURL, 'file://localhost/')
      : nameOrURL
    const [, directories, filename] = url.pathname.match(/[/]?(.*)[/](.*)$/)

    let directoryHandle = DIRECTORY_CACHE.get(directories)
    if (!directoryHandle) {
      directoryHandle = this.#root ?? await this.#rootReady
      for (const directory of directories.split('/')) {
        if (directory)
          directoryHandle = await directoryHandle.getDirectoryHandle(directory, { create })
      }
      DIRECTORY_CACHE.set(directories, directoryHandle)
    }
    return [directoryHandle, filename]
  }
}
