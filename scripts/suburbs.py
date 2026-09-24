"""Pick the suburbs that get their own page and tag each tree with its suburb.

Usage: suburbs.py trees.geojson suburbs.geojson tagged-out.geojson suburbs-out.json
"""
import json
import re
import sys
from collections import Counter

# Suburbs less covered than this would show misleadingly low tree counts
MIN_COVERED = 0.8

trees_path, suburbs_path, tagged_path, out_path = sys.argv[1:]


def pretty(name):
    words = name.title().split()
    return ' '.join('Mc' + w[2:].title() if w.startswith('Mc') else w for w in words)


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def bbox(geometry):
    coords = [c for polygon in geometry['coordinates'] for ring in polygon for c in ring]
    xs, ys = [c[0] for c in coords], [c[1] for c in coords]
    return [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]


trees = json.load(open(trees_path))
counts = Counter(f['properties']['suburb'] for f in trees['features'])

suburbs = []
for feature in json.load(open(suburbs_path))['features']:
    raw = feature['properties']['suburb']
    if feature['properties']['covered'] < MIN_COVERED or counts[raw] == 0:
        continue
    geometry = feature['geometry']
    if geometry['type'] == 'Polygon':
        geometry = {'type': 'MultiPolygon', 'coordinates': [geometry['coordinates']]}
    suburbs.append({
        'raw': raw,
        'name': pretty(raw),
        'slug': slug(raw),
        'count': counts[raw],
        'bbox': bbox(geometry),
        'geometry': geometry,
    })

suburbs.sort(key=lambda s: s['name'])
names = {s['raw']: s['name'] for s in suburbs}

for feature in trees['features']:
    props = feature['properties']
    suburb = names.get(props.pop('suburb'))
    if suburb:
        props['suburb'] = suburb
json.dump(trees, open(tagged_path, 'w'))

for s in suburbs:
    del s['raw']
json.dump(suburbs, open(out_path, 'w'), separators=(',', ':'))

print(f"{len(suburbs)} suburbs, {sum(s['count'] for s in suburbs)} of {len(trees['features'])} trees")
