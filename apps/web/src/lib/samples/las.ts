/** Minimal LAS 1.2 (Point Data Record Format 0) writer — pure JS, little-endian. Engine reads LAS. */
import { mulberry32 } from './prng';

export interface LasPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  ret: number;
  nret: number;
  cls: number;
}

interface Bounds {
  minx: number; miny: number; minz: number;
  maxx: number; maxy: number; maxz: number;
}

function writeStr(u8: Uint8Array, off: number, s: string, len: number): void {
  for (let i = 0; i < len; i++) u8[off + i] = i < s.length ? s.charCodeAt(i) & 0x7f : 0;
}

/** Write LAS 1.2 PDRF0 bytes (227-byte public header + 20-byte records). */
export function writeLas(points: LasPoint[], b: Bounds): Uint8Array {
  const N = points.length;
  const HEADER = 227;
  const REC = 20;
  const buf = new ArrayBuffer(HEADER + REC * N);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  writeStr(u8, 0, 'LASF', 4);
  dv.setUint8(24, 1); // version major
  dv.setUint8(25, 2); // version minor → 1.2
  writeStr(u8, 26, 'GeoLab synthetic', 32);
  writeStr(u8, 58, 'GeoLab', 32);
  dv.setUint16(94, HEADER, true); // header size
  dv.setUint32(96, HEADER, true); // offset to point data
  dv.setUint32(100, 0, true); // number of VLRs
  dv.setUint8(104, 0); // PDRF 0
  dv.setUint16(105, REC, true); // record length
  dv.setUint32(107, N, true); // number of point records

  const byReturn = [0, 0, 0, 0, 0];
  for (const p of points) {
    const ri = Math.min(4, Math.max(0, p.ret - 1));
    byReturn[ri] = (byReturn[ri] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) dv.setUint32(111 + i * 4, byReturn[i] ?? 0, true);

  const scale = 0.001;
  const ox = b.minx;
  const oy = b.miny;
  const oz = b.minz;
  dv.setFloat64(131, scale, true);
  dv.setFloat64(139, scale, true);
  dv.setFloat64(147, scale, true);
  dv.setFloat64(155, ox, true);
  dv.setFloat64(163, oy, true);
  dv.setFloat64(171, oz, true);
  dv.setFloat64(179, b.maxx, true);
  dv.setFloat64(187, b.minx, true);
  dv.setFloat64(195, b.maxy, true);
  dv.setFloat64(203, b.miny, true);
  dv.setFloat64(211, b.maxz, true);
  dv.setFloat64(219, b.minz, true);

  let off = HEADER;
  for (const p of points) {
    dv.setInt32(off + 0, Math.round((p.x - ox) / scale), true);
    dv.setInt32(off + 4, Math.round((p.y - oy) / scale), true);
    dv.setInt32(off + 8, Math.round((p.z - oz) / scale), true);
    dv.setUint16(off + 12, Math.max(0, Math.min(65535, Math.round(p.intensity))), true);
    dv.setUint8(off + 14, (p.ret & 0x7) | ((p.nret & 0x7) << 3));
    dv.setUint8(off + 15, p.cls);
    dv.setInt8(off + 16, 0); // scan angle rank
    dv.setUint8(off + 17, 0); // user data
    dv.setUint16(off + 18, 1, true); // point source id
    off += REC;
  }
  return u8;
}

/** A small synthetic LiDAR cloud: ground (2) + canopy (5) + a few buildings (6). */
export function lidarSmall(n = 3000, seed = 23): Uint8Array {
  const r = mulberry32(seed);
  const X0 = 500000;
  const Y0 = 6000000;
  const span = 2000;
  const pts: LasPoint[] = [];
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = X0 + r() * span;
    const y = Y0 - r() * span;
    const ground = 800 + 30 * Math.exp(-(((x - X0 - span / 2) ** 2 + (y - Y0 + span / 2) ** 2)) / (span * span / 8)) + 0.01 * (x - X0);
    let z = ground;
    let cls = 2;
    const u = r();
    if (u > 0.72) { z = ground + 2 + r() * 15; cls = 5; }
    else if (u > 0.68) { z = ground + 3 + r() * 8; cls = 6; }
    pts.push({ x, y, z, intensity: Math.floor(r() * 40000), ret: 1, nret: 1, cls });
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  return writeLas(pts, { minx, miny, minz, maxx, maxy, maxz });
}
