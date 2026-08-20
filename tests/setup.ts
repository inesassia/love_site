// Node 18's `node` test environment does not expose `File` as a global (it was
// globalized only in Node 20+); Next.js's App Router runtime always provides it,
// so this polyfill only bridges the gap for the local test environment.
import { File } from 'buffer'

if (typeof globalThis.File === 'undefined') {
  // @ts-expect-error -- Node's buffer.File is compatible with the DOM File type used by Next.js
  globalThis.File = File
}
