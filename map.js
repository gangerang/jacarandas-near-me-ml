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

const basemaps = [
  {
    name: 'Streets',
    style: {
      version: 8,
      sources: {
        'carto-voyager': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'carto-voyager-layer',
          type: 'raster',
          source: 'carto-voyager'
        }
      ]
    }
  },
  {
    name: 'Dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
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
          tileSize: 256
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
  }
];

let currentBasemapIndex = 0;
let jacarandaData = null;

const map = new maplibregl.Map({
  container: 'map',
  style: basemaps[currentBasemapIndex].style,
  center: [151.2093, -33.8688],
  zoom: 10
});

map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  })
);

const jacarandaUrl =
  "https://services1.arcgis.com/cNVyNtjGVZybOQWZ/arcgis/rest/services/Trees/FeatureServer/0/query?returnGeometry=true&where=CommonName='Jacaranda'&outSR=4326&f=json";

function addLayers() {
  // Clean up if present (use guards in case of partial state)
  if (map.getLayer('jacarandas-heat')) map.removeLayer('jacarandas-heat');
  if (map.getLayer('jacarandas-point')) map.removeLayer('jacarandas-point');
  if (map.getSource('jacarandas')) map.removeSource('jacarandas');

  if (!jacarandaData) return;

  map.addSource('jacarandas', {
    type: 'geojson',
    data: jacarandaData
  });

  map.addLayer({
    id: 'jacarandas-heat',
    type: 'heatmap',
    source: 'jacarandas',
    maxzoom: 14,
    paint: {
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 14, 3],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(236,222,239,0)',
        0.2,
        '#d0a9e6',
        0.4,
        '#b072d4',
        0.6,
        '#903ac2',
        0.8,
        '#6c2197'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 14, 20],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, 14, 0]
    }
  });

  map.addLayer({
    id: 'jacarandas-point',
    type: 'circle',
    source: 'jacarandas',
    minzoom: 13,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 5],
      'circle-color': '#8A2BE2',
      'circle-stroke-color': 'white',
      'circle-stroke-width': 1,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1]
    }
  });
}

function updateButtonText() {
  const nextBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  document.getElementById('basemap-toggle-btn').textContent =
    basemaps[nextBasemapIndex].name;
}

// Fetch data, then add layers once the initial style is loaded
fetch(jacarandaUrl)
  .then((r) => r.json())
  .then((data) => {
    jacarandaData = {
      type: 'FeatureCollection',
      features: data.features.map((feature) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [feature.geometry.x, feature.geometry.y]
        },
        properties: feature.attributes
      }))
    };

    map.on('load', () => {
      addLayers();
      updateButtonText();
    });
  });

// Cycle basemap styles and re-add jacarandas when the new style is ready
document.getElementById('basemap-toggle-btn').addEventListener('click', () => {
  currentBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  map.setStyle(basemaps[currentBasemapIndex].style);
  updateButtonText();

  // Wait for the new style to finish loading all its sources/layers
  map.once('idle', () => addLayers());
});

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
