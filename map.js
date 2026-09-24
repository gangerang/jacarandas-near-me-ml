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

const map = new maplibregl.Map({
  container: 'map',
  style: basemaps[currentBasemapIndex].style,
  center: [151.2093, -33.88],
  zoom: 11
});

// Add geolocation control
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  })
);

const jacarandaUrl = './data/jacarandas-combined.geojson';

const jacarandaSource = {
  type: 'geojson',
  data: jacarandaUrl
};

const jacarandaLayer = {
  id: 'jacarandas-point',
  type: 'circle',
  source: 'jacarandas',
  minzoom: 8,
  paint: {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      13, 2,  // Base size at zoom 13
      16, 10   // Larger size at zoom 16
    ],
    'circle-color': '#8A2BE2',
    'circle-stroke-color': 'white',
    'circle-stroke-width': 1,
    'circle-opacity': 0.5
  }
};

function addLayers() {
  if (!map.getSource('jacarandas')) {
    map.addSource('jacarandas', jacarandaSource);
  }
  if (!map.getLayer('jacarandas-point')) {
    map.addLayer(jacarandaLayer);
  }
}

// Toggle basemaps by swapping the map style
function toggleBasemap() {
  currentBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  // setStyle diffs styles and skips style.load, so carry the jacaranda layer into the new style
  map.setStyle(basemaps[currentBasemapIndex].style, {
    transformStyle: (previous, next) => ({
      ...next,
      sources: { ...next.sources, jacarandas: jacarandaSource },
      layers: [...next.layers, jacarandaLayer]
    })
  });

  // Update the button text
  const nextBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  document.getElementById('basemap-toggle-btn').textContent = basemaps[nextBasemapIndex].name;
}

// Attach the toggle function to the button
const basemapToggleButton = document.getElementById('basemap-toggle-btn');
if (basemapToggleButton) {
  basemapToggleButton.addEventListener('click', toggleBasemap);

  // Initialize the button text on page load
  const nextBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  basemapToggleButton.textContent = basemaps[nextBasemapIndex].name;
}

map.on('load', addLayers);

// Interactions (these listeners persist across style changes)
map.on('click', 'jacarandas-point', (e) => {
  const coordinates = e.features[0].geometry.coordinates.slice();
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;

  new maplibregl.Popup()
    .setLngLat(coordinates)
    .setHTML(
      `<a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer">Navigate to this Jacaranda</a>`
    )
    .addTo(map);
});

map.on('mouseenter', 'jacarandas-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'jacarandas-point', () => {
  map.getCanvas().style.cursor = '';
});
