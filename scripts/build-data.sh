#!/bin/sh
# Rebuild everything in data/ from data/jacarandas-combined.geojson:
#   jacarandas.pmtiles  trees, tagged with their suburb and size rank within it
#   coverage.geojson    everything outside the mapped area
#   suburbs.json        suburbs mostly inside the mapped area, for scripts/build-pages.mjs
# Needs tippecanoe, ogr2ogr (GDAL with SpatiaLite), python3 and curl
set -e
cd "$(dirname "$0")/.."

SUBURBS=data/src/suburbs.geojson
if [ ! -f "$SUBURBS" ]; then
  mkdir -p data/src
  curl -sf -G "https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Administrative_Boundaries_Theme/FeatureServer/2/query" \
    --data-urlencode "geometry=151.03,-33.93,151.30,-33.75" \
    --data-urlencode "geometryType=esriGeometryEnvelope" \
    --data-urlencode "inSR=4326" \
    --data-urlencode "outFields=suburbname" \
    --data-urlencode "outSR=4326" \
    --data-urlencode "geometryPrecision=6" \
    --data-urlencode "f=geojson" \
    -o "$SUBURBS"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
DB=$TMP/work.gpkg

ogr2ogr -f GPKG "$DB" data/jacarandas-combined.geojson -nln trees
ogr2ogr -f GPKG -update "$DB" "$SUBURBS" -nln suburbs -nlt MULTIPOLYGON
ogr2ogr -f GPKG -update "$DB" "$DB" -nln hull -dialect sqlite \
  -sql "SELECT ST_Buffer(ConcaveHull(ST_Collect(geom), 10), 0.003) AS geometry FROM trees"

# SpatiaLite can't combine BuildMbr with GeoPackage geometries, so go via GeoJSON
ogr2ogr -f GeoJSON "$TMP/hull.geojson" "$DB" hull
ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=5 data/coverage.geojson "$TMP/hull.geojson" -dialect sqlite \
  -sql "SELECT ST_Difference(BuildMbr(-180, -85, 180, 85, 4326), ST_SimplifyPreserveTopology(geometry, 0.0003)) AS geometry FROM hull"

ogr2ogr -f GeoJSON "$TMP/trees.geojson" "$DB" -dialect sqlite \
  -sql "SELECT t.area_m2, s.suburbname AS suburb, t.geom FROM trees t
        LEFT JOIN suburbs s ON ST_Intersects(t.geom, s.geom)
        AND s.ROWID IN (SELECT id FROM rtree_suburbs_geom r
                        WHERE r.minx <= ST_X(t.geom) AND r.maxx >= ST_X(t.geom)
                          AND r.miny <= ST_Y(t.geom) AND r.maxy >= ST_Y(t.geom))"

ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=5 "$TMP/suburbs.geojson" "$DB" -dialect sqlite \
  -sql "SELECT s.suburbname AS suburb, ST_Area(ST_Intersection(s.geom, h.geometry)) / ST_Area(s.geom) AS covered,
               ST_SimplifyPreserveTopology(s.geom, 0.0001) AS geometry
        FROM suburbs s, hull h WHERE ST_Intersects(s.geom, h.geometry)"

ogr2ogr -f CSV "$TMP/neighbours.csv" "$DB" -dialect sqlite \
  -sql "SELECT a.suburbname AS a, b.suburbname AS b FROM suburbs a, suburbs b
        WHERE a.fid < b.fid
          AND b.fid IN (SELECT id FROM rtree_suburbs_geom r
                        WHERE r.minx <= ST_MaxX(a.geom) AND r.maxx >= ST_MinX(a.geom)
                          AND r.miny <= ST_MaxY(a.geom) AND r.maxy >= ST_MinY(a.geom))
          AND ST_Intersects(a.geom, b.geom)"

python3 scripts/suburbs.py "$TMP/trees.geojson" "$TMP/suburbs.geojson" "$TMP/neighbours.csv" "$TMP/tagged.geojson" data/suburbs.json

tippecanoe -q -f -o data/jacarandas.pmtiles -l jacarandas \
  -Z8 -z14 -r1 --no-feature-limit --no-tile-size-limit \
  "$TMP/tagged.geojson"
