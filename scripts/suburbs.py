"""Pick the suburbs that get their own page, summarise them, and tag each tree with its suburb.

Usage: suburbs.py trees.geojson suburbs.geojson neighbours.csv tagged-out.geojson suburbs-out.json
"""
import csv
import json
import math
import re
import sys
from collections import Counter, defaultdict

# Suburbs less covered than this would show misleadingly low tree counts
MIN_COVERED = 0.8
# Trees ranked at or below this within their suburb get a rank in the tiles
TOP_RANK = 10

trees_path, suburbs_path, neighbours_path, tagged_path, out_path = sys.argv[1:]


def pretty(name):
    words = name.title().split()
    return ' '.join('Mc' + w[2:].title() if w.startswith('Mc') else w for w in words)


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def bbox(geometry):
    coords = [c for polygon in geometry['coordinates'] for ring in polygon for c in ring]
    xs, ys = [c[0] for c in coords], [c[1] for c in coords]
    return [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]


def area_km2(geometry):
    # Shoelace on an equirectangular projection, plenty accurate at suburb scale
    total = 0
    for polygon in geometry['coordinates']:
        for i, ring in enumerate(polygon):
            lat0 = math.radians(ring[0][1])
            pts = [(x * 111.32 * math.cos(lat0), y * 110.57) for x, y in ring]
            ring_area = abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:]))) / 2
            total += ring_area if i == 0 else -ring_area
    return total


trees = json.load(open(trees_path))
counts = Counter(f['properties']['suburb'] for f in trees['features'])

neighbours = defaultdict(set)
for row in csv.DictReader(open(neighbours_path)):
    neighbours[row['a']].add(row['b'])
    neighbours[row['b']].add(row['a'])

suburbs = {}
for feature in json.load(open(suburbs_path))['features']:
    raw = feature['properties']['suburb']
    if feature['properties']['covered'] < MIN_COVERED or counts[raw] == 0:
        continue
    geometry = feature['geometry']
    if geometry['type'] == 'Polygon':
        geometry = {'type': 'MultiPolygon', 'coordinates': [geometry['coordinates']]}
    area = area_km2(geometry)
    suburbs[raw] = {
        'name': pretty(raw),
        'slug': slug(raw),
        'count': counts[raw],
        'areaKm2': round(area, 2),
        'perKm2': round(counts[raw] / area),
        'bbox': bbox(geometry),
        'geometry': geometry,
    }

for rank, s in enumerate(sorted(suburbs.values(), key=lambda s: -s['perKm2']), 1):
    s['densityRank'] = rank

for raw, s in suburbs.items():
    s['neighbours'] = sorted((suburbs[n]['slug'] for n in neighbours[raw] if n in suburbs),
                             key=lambda n: next(x['name'] for x in suburbs.values() if x['slug'] == n))

by_suburb = defaultdict(list)
for feature in trees['features']:
    props = feature['properties']
    raw = props.pop('suburb')
    if raw in suburbs:
        props['suburb'] = suburbs[raw]['name']
        by_suburb[raw].append(feature)

for raw, features in by_suburb.items():
    features.sort(key=lambda f: -f['properties']['area_m2'])
    for rank, feature in enumerate(features[:TOP_RANK], 1):
        feature['properties']['rank'] = rank
    suburbs[raw]['biggest'] = [
        [round(c, 6) for c in f['geometry']['coordinates']] + [round(f['properties']['area_m2'])]
        for f in features[:5]
    ]

json.dump(trees, open(tagged_path, 'w'))

out = sorted(suburbs.values(), key=lambda s: s['name'])
json.dump(out, open(out_path, 'w'), separators=(',', ':'))

print(f"{len(out)} suburbs, {sum(s['count'] for s in out)} of {len(trees['features'])} trees")
