// Show a banner if running on dev.jacarandas.com.au
if (window.location.hostname.startsWith("dev.")) {
  const banner = document.createElement("div");
  banner.id = "env-banner";
  banner.textContent = "🚧 Development Environment 🚧";
  document.body.prepend(banner);

  // push map down so banner doesn’t overlap
  const mapDiv = document.getElementById("map");
  if (mapDiv) {
    mapDiv.style.top = "40px"; // adjust height for the banner
  }
}

// OpenFreeMap vector styles (https://openfreemap.org); satellite stays on Esri raster tiles
const basemaps = [
  {
    name: 'Streets',
    style: 'https://tiles.openfreemap.org/styles/liberty'
  },
  {
    name: 'Satellite',
    style: {
      version: 8,
      sources: {
        'esri-world-imagery': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          // Esri serves "Map data not yet available" tiles past this in Sydney; overzoom instead
          maxzoom: 20,
          attribution: '© <a href="https://www.esri.com" target="_blank">Esri</a>'
        }
      },
      layers: [
        {
          id: 'esri-world-imagery-layer',
          type: 'raster',
          source: 'esri-world-imagery'
        }
      ]
    }
  },
  {
    name: 'Dark',
    style: 'https://tiles.openfreemap.org/styles/dark'
  }
];

let currentBasemapIndex = 0;

// Read before the map writes its own position into the hash
const openedSharedLink = window.location.hash.length > 1;

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Suburb pages (/in/<suburb>/) open on the suburb
const suburbBounds = document.querySelector('meta[name="suburb-bounds"]')?.content.split(',').map(Number);

const wideLayout = window.matchMedia('(min-width: 700px)');

// Keep what the map is framing clear of the suburb panel
function panelPadding() {
  const panel = document.getElementById('suburb-panel');
  if (!panel || panel.hidden) return 20;
  return wideLayout.matches
    ? { top: 20, right: 20, bottom: 20, left: panel.offsetWidth + 30 }
    : { top: 20, right: 20, left: 20, bottom: panel.offsetHeight + 50 };
}

const map = new maplibregl.Map({
  container: 'map',
  style: basemaps[currentBasemapIndex].style,
  center: [151.2093, -33.88],
  zoom: 11,
  bounds: suburbBounds,
  fitBoundsOptions: { padding: panelPadding() },
  hash: true,
  attributionControl: {
    customAttribution: [
      'An <a href="https://al3x.au" target="_blank">al3x.au</a> project',
      '<a href="https://maplibre.org/" target="_blank">MapLibre</a>'
    ]
  }
});

const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true
});
map.addControl(geolocate);

const overlaySources = {
  jacarandas: {
    type: 'vector',
    url: `pmtiles://${window.location.origin}/data/jacarandas.pmtiles`,
    attribution: 'Jacarandas detected from aerial imagery'
  },
  coverage: {
    type: 'geojson',
    data: '/data/coverage.geojson'
  }
};

const canopyArea = ['get', 'area_m2'];

const overlayLayers = [
  {
    id: 'coverage-mask',
    type: 'fill',
    source: 'coverage',
    paint: {
      'fill-color': '#333',
      'fill-opacity': 0.25
    }
  },
  {
    id: 'coverage-outline',
    type: 'line',
    source: 'coverage',
    paint: {
      'line-color': '#8A2BE2',
      'line-width': 1.5,
      'line-opacity': 0.7,
      'line-dasharray': [3, 2]
    }
  },
  {
    id: 'jacarandas-heat',
    type: 'heatmap',
    source: 'jacarandas',
    'source-layer': 'jacarandas',
    maxzoom: 15,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], canopyArea, 5, 0.3, 100, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.15, 11, 0.3, 14, 1],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 11, 8, 14, 20],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(138, 43, 226, 0)',
        0.15, 'rgba(186, 140, 240, 0.35)',
        0.5, 'rgba(138, 43, 226, 0.55)',
        1, 'rgba(106, 31, 181, 0.75)'
      ],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, 14.5, 0]
    }
  },
  {
    id: 'jacarandas-point',
    type: 'circle',
    source: 'jacarandas',
    'source-layer': 'jacarandas',
    minzoom: 13,
    layout: {
      // Smaller trees draw on top so they aren't hidden under big canopies
      'circle-sort-key': ['-', 0, canopyArea]
    },
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, ['interpolate', ['linear'], canopyArea, 5, 1.5, 25, 2.5, 100, 4, 500, 7],
        16, ['interpolate', ['linear'], canopyArea, 5, 4, 25, 6, 100, 10, 500, 18],
        19, ['interpolate', ['linear'], canopyArea, 5, 10, 25, 16, 100, 28, 500, 50]
      ],
      'circle-color': '#8A2BE2',
      'circle-stroke-color': 'white',
      'circle-stroke-width': 1,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.6],
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1]
    }
  }
];

function addOverlays() {
  for (const [id, source] of Object.entries(overlaySources)) {
    if (!map.getSource(id)) map.addSource(id, source);
  }
  for (const layer of overlayLayers) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
}

// Swap basemaps, carrying the overlays into the new style (setStyle diffs styles and skips style.load)
function setBasemap(index) {
  currentBasemapIndex = index;
  map.setStyle(basemaps[index].style, {
    transformStyle: (previous, next) => ({
      ...next,
      sources: { ...next.sources, ...overlaySources },
      layers: [...next.layers, ...overlayLayers]
    })
  });
}

class ButtonControl {
  constructor(className, title, text, onClick) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = className;
    this.button.title = title;
    this.button.textContent = text;
    this.button.addEventListener('click', onClick);
  }

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

const nextBasemap = () => basemaps[(currentBasemapIndex + 1) % basemaps.length];

const basemapControl = new ButtonControl('basemap-toggle-btn', 'Change basemap', nextBasemap().name, () => {
  setBasemap((currentBasemapIndex + 1) % basemaps.length);
  basemapControl.button.textContent = nextBasemap().name;
});
map.addControl(basemapControl, 'top-right');

const intro = document.getElementById('intro');
map.addControl(new ButtonControl('info-btn', 'About this map', 'i', () => intro.showModal()), 'top-right');

intro.addEventListener('close', () => {
  try { localStorage.setItem('introSeen', '1'); } catch (e) {}
  if (intro.returnValue === 'locate') geolocate.trigger();
});

let introSeen = false;
try { introSeen = localStorage.getItem('introSeen') === '1'; } catch (e) {}
// Skip the intro for shared links, which already point somewhere specific
if (!introSeen && !openedSharedLink) intro.showModal();

// Must match slug() in scripts/suburbs.py
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Trees in a suburb with its own page share that page, so the link preview names the suburb
function treeUrl(lngLat, suburb) {
  const lat = lngLat.lat.toFixed(6);
  const lng = lngLat.lng.toFixed(6);
  const zoom = Math.round(map.getZoom() * 100) / 100;
  const path = suburb ? `/in/${slugify(suburb)}/` : '/';
  return `${window.location.origin}${path}?tree=${lat},${lng}#${zoom}/${lat}/${lng}`;
}

// Canopy diameter from its area; must match across() in scripts/build-pages.mjs
const acrossMetres = (area) => Math.round(2 * Math.sqrt(area / Math.PI));

function showTreePopup(lngLat, { area_m2: area, suburb, rank } = {}) {
  const { lat, lng } = lngLat;
  const lines = [];
  if (suburb) lines.push(`<strong>${suburb}</strong>`);
  lines.push(area ? `About ${acrossMetres(area)} m across` : 'A jacaranda');
  if (rank === 1) lines.push('The biggest here');
  else if (rank) lines.push('One of the 10 biggest here');

  const content = document.createElement('div');
  content.className = 'tree-popup';
  content.innerHTML = `
    <p>${lines.join('<br>')}</p>
    <div class="actions">
      <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer">Directions</a>
      <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}" target="_blank" rel="noopener noreferrer">Street View</a>
      <button type="button" class="share">Share</button>
    </div>
    ${suburb ? `<button type="button" class="more">More in ${suburb} →</button>` : ''}
  `;

  content.querySelector('.more')?.addEventListener('click', () => openSuburb(slugify(suburb), false));

  const shareButton = content.querySelector('.share');
  shareButton.addEventListener('click', async () => {
    const url = treeUrl(lngLat, suburb);
    if (navigator.share) {
      try { await navigator.share({ title: suburb ? `A jacaranda in ${suburb}` : 'A jacaranda', url }); } catch (e) {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      shareButton.textContent = 'Link copied';
    } catch (e) {
      const link = document.createElement('input');
      link.readOnly = true;
      link.value = url;
      shareButton.replaceWith(link);
      link.select();
    }
  });

  new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(lngLat).setDOMContent(content).addTo(map);
}

let panel = document.getElementById('suburb-panel');
if (panel) setUpPanel(panel);

function setUpPanel(el) {
  map.getContainer().appendChild(el);
  el.querySelector('.panel-close').addEventListener('click', () => { el.hidden = true; });

  el.querySelectorAll('.biggest button').forEach((button, i) => button.addEventListener('click', () => {
    const lngLat = new maplibregl.LngLat(Number(button.dataset.lng), Number(button.dataset.lat));
    map.flyTo({ center: lngLat, zoom: 18, padding: panelPadding() });
    showTreePopup(lngLat, { area_m2: Number(button.dataset.area), suburb: el.dataset.name, rank: i + 1 });
  }));

  el.querySelectorAll('.nearby a').forEach((link) => link.addEventListener('click', (e) => {
    e.preventDefault();
    openSuburb(link.dataset.slug, true);
  }));
}

// Panels are only written into suburb pages, so fetch the suburb's page to show one anywhere
async function openSuburb(slug, fly) {
  if (panel?.dataset.slug !== slug) {
    const response = await fetch(`/in/${slug}/`);
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    panel?.remove();
    panel = page.getElementById('suburb-panel');
    setUpPanel(panel);
  }
  panel.hidden = false;
  if (fly) map.fitBounds(panel.dataset.bounds.split(',').map(Number), { padding: panelPadding() });
}

map.on('load', () => {
  addOverlays();

  const tree = new URLSearchParams(window.location.search).get('tree');
  const [lat, lng] = (tree || '').split(',').map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const lngLat = new maplibregl.LngLat(lng, lat);
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    // Wait for the tiles so the popup can show the tree's details
    map.once('idle', () => {
      const point = map.project(lngLat);
      const [feature] = map.queryRenderedFeatures(
        [[point.x - 2, point.y - 2], [point.x + 2, point.y + 2]],
        { layers: ['jacarandas-point'] }
      );
      showTreePopup(lngLat, feature?.properties);
    });
  }
});

// Interactions (these listeners persist across style changes)
map.on('click', 'jacarandas-point', (e) => {
  const feature = e.features[0];
  const [lng, lat] = feature.geometry.coordinates;
  showTreePopup(new maplibregl.LngLat(lng, lat), feature.properties);
});

map.on('mouseenter', 'jacarandas-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'jacarandas-point', () => {
  map.getCanvas().style.cursor = '';
});
