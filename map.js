const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [151.2093, -33.8688],
    zoom: 12
});

map.addControl(new maplibregl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
}));

const jacarandaUrl = "https://services1.arcgis.com/cNVyNtjGVZybOQWZ/arcgis/rest/services/Trees/FeatureServer/0/query?returnGeometry=true&where=CommonName='Jacaranda'&outSR=4326&f=json";

map.on('load', () => {
    fetch(jacarandaUrl)
        .then(response => response.json())
        .then(data => {
            const geojson = {
                type: 'FeatureCollection',
                features: data.features.map(feature => {
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [feature.geometry.x, feature.geometry.y]
                        },
                        properties: feature.attributes
                    };
                })
            };

            map.addSource('jacarandas', {
                type: 'geojson',
                data: geojson
            });

            map.addLayer({
                'id': 'jacarandas-layer',
                'type': 'circle',
                'source': 'jacarandas',
                'paint': {
                    'circle-radius': 4,
                    'circle-color': '#8A2BE2',
                    'circle-opacity': 0.6
                }
            });

            map.on('click', 'jacarandas-layer', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;

                new maplibregl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`<a href="${googleMapsUrl}" target="_blank">Navigate to this Jacaranda</a>`)
                    .addTo(map);
            });

            // Change the cursor to a pointer when the mouse is over the jacarandas layer.
            map.on('mouseenter', 'jacarandas-layer', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            // Change it back to a pointer when it leaves.
            map.on('mouseleave', 'jacarandas-layer', () => {
                map.getCanvas().style.cursor = '';
            });
        });
});