# Jacarandas near me
Map of jacaranda trees in Sydney, detected from aerial imagery. Heatmap when zoomed out, individual trees sized by canopy area when zoomed in.
Running on MapLibre with PMTiles.

Each suburb mostly inside the mapped area has its own page at `/in/<suburb>/`, with its own link preview image. Shared trees link to their suburb's page.

## Data
`data/jacarandas-combined.geojson` is the source. After changing it:

1. `scripts/build-data.sh` (needs tippecanoe, GDAL and python3) rebuilds `data/jacarandas.pmtiles`, `data/coverage.geojson` and `data/suburbs.json`. Suburb boundaries are downloaded from NSW Spatial Services into `data/src/` on first run.
2. `npm --prefix scripts install` once, then `node scripts/build-pages.mjs --images` rebuilds the suburb pages, their preview images (needs Chromium) and `sitemap.xml`.

Commit everything it changes.

## Releasing
Cloudflare caches `map.js` and `style.css` for 4 hours. Bump the `?v=` on both in `index.html` whenever either changes.

Suburb pages are copies of `index.html`, so after changing it run `node scripts/build-pages.mjs` (no `--images` needed).
