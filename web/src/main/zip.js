// Minimal ZIP reader for resource packs: central directory + stored/deflated entries (DecompressionStream).

const u16 = (d, o) => d[o] | (d[o + 1] << 8);
const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;

/** Lists entries: Map name -> { method, size, offset } without inflating anything. */
export function listZip(bytes) {
  const d = bytes;
  let eocd = -1;
  for (let i = d.length - 22; i >= Math.max(0, d.length - 65557); i--) if (u32(d, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This file is not a ZIP archive.');
  const count = u16(d, eocd + 10);
  let p = u32(d, eocd + 16);
  const out = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(d, p) !== 0x02014b50) throw new Error('The ZIP central directory is damaged.');
    const method = u16(d, p + 10), csize = u32(d, p + 20), nlen = u16(d, p + 28), elen = u16(d, p + 30), clen = u16(d, p + 32);
    const local = u32(d, p + 42);
    const name = dec.decode(d.subarray(p + 46, p + 46 + nlen));
    out.set(name, { method, csize, local });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

/** The uncompressed bytes of one entry. */
export async function readEntry(bytes, e) {
  const d = bytes, p = e.local;
  if (u32(d, p) !== 0x04034b50) throw new Error('A ZIP entry header is damaged.');
  const start = p + 30 + u16(d, p + 26) + u16(d, p + 28);
  const raw = d.subarray(start, start + e.csize);
  if (e.method === 0) return raw.slice();
  if (e.method !== 8) throw new Error(`Unsupported ZIP compression (method ${e.method}).`);
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
