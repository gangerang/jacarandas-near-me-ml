# Jacarandas near me
Map of jacaranda trees in Sydney, detected from aerial imagery. Heatmap when zoomed out, individual trees sized by canopy area when zoomed in.
Running on MapLibre with PMTiles.

## Data
`data/jacarandas-combined.geojson` is the source. After changing it, run `scripts/build-tiles.sh` (needs tippecanoe and GDAL) to rebuild `data/jacarandas.pmtiles` and `data/coverage.geojson`, and commit all three.
