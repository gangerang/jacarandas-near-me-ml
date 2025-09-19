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

const jacarandaUrl = './data/jacarandas_city-of-sydney.geojson';

function addLayers() {
  // Check if the jacarandas source already exists
  if (!map.getSource('jacarandas')) {
    map.addSource('jacarandas', {
      type: 'geojson',
      data: jacarandaUrl
    });
  }

  // Add or update the jacarandas-heat layer
  if (!map.getLayer('jacarandas-heat')) {
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
  }

  // Add or update the jacarandas-point layer
  if (!map.getLayer('jacarandas-point')) {
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
}

// Function to toggle basemaps
function toggleBasemap() {
  // Increment the index and wrap around if necessary
  currentBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;

  // Set the new basemap style
  const newStyle = basemaps[currentBasemapIndex].style;
  map.setStyle(newStyle);

  // Ensure the button text reflects the next basemap
  const nextBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  document.getElementById('basemap-toggle-btn').textContent = basemaps[nextBasemapIndex].name;

  // Explicitly re-add jacaranda layers after the new style loads
  map.once('style.load', () => {
    console.log(`Basemap switched to: ${basemaps[currentBasemapIndex].name}`);
    addLayers();
  });
}

// Attach the toggle function to the button
const basemapToggleButton = document.getElementById('basemap-toggle-btn');
if (basemapToggleButton) {
  basemapToggleButton.addEventListener('click', toggleBasemap);

  // Initialize the button text on page load
  const nextBasemapIndex = (currentBasemapIndex + 1) % basemaps.length;
  basemapToggleButton.textContent = basemaps[nextBasemapIndex].name;
}

// Add layers once the initial style is loaded
map.on('load', () => {
  addLayers();
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
