# GeoLab docs wiki

Authored as we build (ADR-0056), SimLab-style: a folder per theme + a same-named landing page + numbered
deep pages. Planned tree:

```
docs/
  architecture/     what GeoLab is; the multi-engine tool registry; the worker runner; provenance; deploy
  frameworks/       one folder per integrated engine (geolibre, gdal, geos, turf, h3, ... ): what it is,
                    what we use, license, how the adapter maps it, gotchas, citations
  guides/           how to: load your data · run a tool · build a pipeline · save/share a recipe
  cases/            the curated showcase analyses (terrain, hydrology, LiDAR, imagery, vector, change)
  methods/          the math behind each tool family (KaTeX), with references
```

Principles (CAOS): theory + equations + references + SVGs; what each tool *is and is not*; how to use it on
your own data; the data contract + outlier handling. No internal repo paths in any user-facing text.

> Status: scaffolding. The first pages land with the first wired tool (slope from a sample DEM).
