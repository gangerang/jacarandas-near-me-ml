const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [151.2093, -33.8688],
    zoom: 10
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
                id: 'jacarandas-heat',
                type: 'heatmap',
                source: 'jacarandas',
                maxzoom: 14,
                paint: {
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0,
                        1,
                        14,
                        3
                    ],
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
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0,
                        2,
                        14,
                        20
                    ],
                    'heatmap-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        13,
                        1,
                        14,
                        0
                    ]
                }
            });

            map.addLayer({
                id: 'jacarandas-point',
                type: 'circle',
                source: 'jacarandas',
                minzoom: 13,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        13,
                        2,
                        16,
                        5
                    ],
                    'circle-color': '#8A2BE2',
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 1,
                    'circle-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        13,
                        0,
                        14,
                        1
                    ]
                }
            });

            map.on('click', 'jacarandas-point', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;

                new maplibregl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`<a href="${googleMapsUrl}" target="_blank">Navigate to this Jacaranda</a>`)
                    .addTo(map);
            });

            map.on('mouseenter', 'jacarandas-point', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'jacarandas-point', () => {
                map.getCanvas().style.cursor = '';
            });
        });
});
