/** Declarative catalog of synthetic sample datasets — the Workbench "Add sample" menu reads this. */
import type { PortKind } from '@geolab/tool-core';
import type { Grid } from '../grid';
import type { GeoJSONFeatureCollection } from '../geojson';
import type { CmapName } from '../colormap';
import { writeSyntheticDem } from '../dem';
import * as R from './raster';
import * as V from './vector';
import { csvXyz } from './csv';
import { lidarSmall } from './las';

export interface SampleResult {
  bytes: Uint8Array;
  ext: string; // tif | geojson | las | csv
  kind: PortKind;
  grid?: Grid;
  geojson?: GeoJSONFeatureCollection;
  cmap?: CmapName;
  unit?: string;
}

export interface SampleDef {
  id: string;
  name: string;
  group: string;
  kind: PortKind;
  summary: string;
  generate: () => Promise<SampleResult>;
}

const raster = (gen: Promise<{ bytes: Uint8Array; grid: Grid }>, cmap: CmapName, unit?: string): Promise<SampleResult> =>
  gen.then(({ bytes, grid }) => ({ bytes, ext: 'tif', kind: 'raster' as PortKind, grid, cmap, unit }));
const vector = (fc: GeoJSONFeatureCollection): Promise<SampleResult> =>
  Promise.resolve({ bytes: V.geojsonToBytes(fc), ext: 'geojson', kind: 'vector' as PortKind, geojson: fc });

export const SAMPLES: SampleDef[] = [
  { id: 'dem-smooth', name: 'Smooth DEM', group: 'Raster & Terrain', kind: 'raster', summary: 'Two Gaussian hills + tilt. Slope, aspect, hillshade, curvature, contours.',
    generate: () => writeSyntheticDem().then(({ bytes, grid }) => ({ bytes, ext: 'tif', kind: 'raster', grid, cmap: 'terrain', unit: 'm' })) },
  { id: 'dem-sinks', name: 'DEM with pits/sinks', group: 'Raster & Terrain', kind: 'raster', summary: 'Carved closed depressions. Fill/breach depressions, extract sinks, find no-flow cells.',
    generate: () => raster(R.genDemSinks(), 'terrain', 'm') },
  { id: 'dem-cone', name: 'Steep cone', group: 'Raster & Terrain', kind: 'raster', summary: 'Near-conical peak (~45°). Stress test for slope/aspect/curvature.',
    generate: () => raster(R.genDemCone(), 'terrain', 'm') },
  { id: 'landcover', name: 'Land-cover classes', group: 'Raster & Terrain', kind: 'raster', summary: 'Integer classes in blobs. raster_to_vector_polygons, clump, zonal stats, majority filter.',
    generate: () => raster(R.genLandcover(), 'viridis') },
  { id: 'continuous', name: 'Continuous field', group: 'Raster & Terrain', kind: 'raster', summary: 'Smooth scalar field. Reclass, threshold, raster calculator, z-scores.',
    generate: () => raster(R.genContinuous(), 'viridis') },
  { id: 'pts-value', name: 'Points with a value field', group: 'Vector & Points', kind: 'vector', summary: '~250 points carrying a numeric "value". IDW, kriging, directional_variogram, field selector.',
    generate: () => vector(V.ptsValue()) },
  { id: 'pts-random', name: 'Random points', group: 'Vector & Points', kind: 'vector', summary: '~200 scattered points. Convex hull, Voronoi/Thiessen, nearest-neighbour, density.',
    generate: () => vector(V.ptsRandom()) },
  { id: 'polys-parcels', name: 'Polygon parcels', group: 'Vector & Points', kind: 'vector', summary: 'Grid of parcels (zone, area). Area, perimeter, buffer, dissolve, polygon_to_raster.',
    generate: () => vector(V.polysParcels()) },
  { id: 'lines-network', name: 'Line network', group: 'Vector & Points', kind: 'vector', summary: 'Polylines (class). Length, simplify, buffer, line intersections, split.',
    generate: () => vector(V.linesNetwork()) },
  { id: 'polys-overlap', name: 'Overlapping polygons', group: 'Vector & Points', kind: 'vector', summary: 'Intersecting polygons. Union, intersect, difference, clip, count overlaps.',
    generate: () => vector(V.polysOverlap()) },
  { id: 'lidar-small', name: 'LiDAR point cloud', group: 'LiDAR & Table', kind: 'pointcloud', summary: '~3k LAS points (ground/veg/building). lidar_info, IDW→DSM, ground filter, segmentation.',
    generate: () => Promise.resolve({ bytes: lidarSmall(), ext: 'las', kind: 'pointcloud' as PortKind }) },
  { id: 'csv-xyz', name: 'X/Y/value table', group: 'LiDAR & Table', kind: 'table', summary: '~300 rows x,y,value. add_point_coordinates_to_table, csv→points, table stats.',
    generate: () => Promise.resolve({ bytes: csvXyz(), ext: 'csv', kind: 'table' as PortKind }) },
];

export const SAMPLE_GROUPS: string[] = [...new Set(SAMPLES.map((s) => s.group))];

/** A curated starter workspace covering every category. */
export const DEMO_WORKSPACE: string[] = ['dem-smooth', 'dem-sinks', 'landcover', 'pts-value', 'polys-parcels', 'lidar-small', 'csv-xyz'];
