#!/bin/sh
# Rebuild data/jacarandas.pmtiles, and data/coverage.geojson (everything outside the mapped area) from data/jacarandas-combined.geojson
# Needs tippecanoe and ogr2ogr (GDAL with SpatiaLite)
set -e
cd "$(dirname "$0")/.."

tippecanoe -q -f -o data/jacarandas.pmtiles -l jacarandas \
  -Z8 -z14 -r1 --no-feature-limit --no-tile-size-limit \
  -y area_m2 \
  data/jacarandas-combined.geojson

ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=5 data/coverage.geojson data/jacarandas-combined.geojson \
  -dialect sqlite \
  -sql "SELECT ST_Difference(BuildMbr(-180, -85, 180, 85, 4326), ST_SimplifyPreserveTopology(ST_Buffer(ConcaveHull(ST_Collect(geometry), 10), 0.003), 0.0003)) AS geometry FROM \"jacarandas-combined-wgs84\""
