/**
 * Raster I/O via geolibre's OWN browser library (the wasm-bindgen `.` export). We use geolibre to WRITE
 * inputs (CogBuilder) and READ outputs (geotiff_read_band_f64) so the bytes round-trip exactly through the
 * same engine that the tools use — geotiff.js mis-encodes/mis-decodes geolibre's tiled COGs.
 *
 * This loads geolibre's browser-lib wasm (~4.4 MB), separate from the WASI tool runner (~17.6 MB).
 */
import init, { CogBuilder, GeoTiffReader, geotiff_info, geotiff_read_band_f64 } from 'geolibre-wasm';
import { gridStats, type Grid } from '../lib/grid';

let inited: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!inited) inited = init().then(() => undefined);
  return inited;
}

export interface DemOpts {
  epsg?: number;
  originX?: number;
  originY?: number;
  pixelSize?: number;
}

/** Encode a single-band f32 raster as a georeferenced (tiled, Deflate) COG that the tools read correctly. */
export async function writeRasterCog(values: Float32Array, width: number, height: number, opts: DemOpts = {}): Promise<Uint8Array> {
  await ensureInit();
  const b = new CogBuilder(width, height, 1);
  b.set_origin(opts.originX ?? 500000, opts.originY ?? 6000000, opts.pixelSize ?? 30);
  b.set_epsg(opts.epsg ?? 32719);
  b.set_compression('deflate');
  const bytes = b.write_f32(values);
  b.free();
  return bytes;
}

/** Read band 0 of any GeoTIFF/COG (geolibre converts from the on-disk sample format) into a Grid. */
export async function readCogGrid(bytes: Uint8Array): Promise<Grid> {
  await ensureInit();
  const info = JSON.parse(geotiff_info(bytes)) as { width: number; height: number };
  const values = Float32Array.from(geotiff_read_band_f64(bytes, 0));
  return gridStats(values, info.width, info.height);
}

/**
 * Return the WGS84 bounding box [minLon, minLat, maxLon, maxLat] of a GeoTIFF/COG, or null if
 * the raster has no spatial reference or geolibre cannot reproject it to WGS84.
 */
export async function readCogBoundsLonLat(bytes: Uint8Array): Promise<[number, number, number, number] | null> {
  await ensureInit();
  const reader = new GeoTiffReader(bytes);
  const bbox = reader.bounds_lonlat();
  reader.free();
  if (bbox.length < 4) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  if (minLon === undefined || minLat === undefined || maxLon === undefined || maxLat === undefined) return null;
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) return null;
  return [minLon, minLat, maxLon, maxLat];
}
