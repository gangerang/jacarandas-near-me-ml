// Write a page per suburb in data/suburbs.json to in/<slug>/index.html, plus sitemap.xml.
// With --images, also screenshot each suburb's link preview to in/<slug>/og.jpg (needs Chromium;
// set CHROMIUM to its path if it isn't /usr/bin/chromium). --only=glebe,mosman limits the images to those suburbs.
//
// Pages are copies of index.html, so rerun this after changing index.html.
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const SITE = 'https://www.jacarandas.com.au';
const root = resolve(import.meta.dirname, '..');
const suburbs = JSON.parse(readFileSync(join(root, 'data/suburbs.json'), 'utf8'));
const template = readFileSync(join(root, 'index.html'), 'utf8');
const withImages = process.argv.includes('--images');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const trees = (count) => `${count.toLocaleString('en-AU')} jacaranda${count === 1 ? '' : 's'}`;

function replace(html, from, to) {
  if (!html.includes(from)) throw new Error(`index.html no longer contains: ${from}`);
  return html.replace(from, to);
}

function suburbPage(suburb) {
  const name = escape(suburb.name);
  const url = `${SITE}/in/${suburb.slug}/`;
  const description = `${trees(suburb.count)} mapped in ${name}, Sydney. Find the purple blooms near you.`;
  let html = template;
  html = replace(html, '<title>Jacarandas Near Me</title>', `<title>Jacarandas in ${name} · Jacarandas Near Me</title>`);
  html = replace(html, /<meta name="description" content="[^"]*">/.exec(html)[0], `<meta name="description" content="${description}">`);
  html = replace(html, '<link rel="canonical" href="https://www.jacarandas.com.au/">',
    `<link rel="canonical" href="${url}">\n    <meta name="suburb-bounds" content="${suburb.bbox.join(',')}">`);
  html = replace(html, '<meta property="og:title" content="Jacarandas Near Me">', `<meta property="og:title" content="Jacarandas in ${name}">`);
  html = replace(html, /<meta property="og:description" content="[^"]*">/.exec(html)[0], `<meta property="og:description" content="${description}">`);
  html = replace(html, '<meta property="og:url" content="https://www.jacarandas.com.au/">', `<meta property="og:url" content="${url}">`);
  html = replace(html, '<meta property="og:image" content="https://www.jacarandas.com.au/og-image.jpg">', `<meta property="og:image" content="${url}og.jpg">`);
  html = replace(html, /<meta property="og:image:alt" content="[^"]*">/.exec(html)[0],
    `<meta property="og:image:alt" content="Map of ${name} with its jacaranda trees marked in purple">`);
  html = replace(html, '<h1>Jacarandas Near Me</h1>', `<h1>Jacarandas in ${name}</h1>`);
  html = replace(html, "<p class='lede'>Over 21,000 jacarandas across inner Sydney,",
    `<p class='lede'>${trees(suburb.count)} in ${name}, and over 21,000 across inner Sydney,`);
  return html;
}

// Drop pages for suburbs no longer in the list, keeping existing images for the rest
const slugs = new Set(suburbs.map((s) => s.slug));
if (existsSync(join(root, 'in'))) {
  for (const dir of readdirSync(join(root, 'in'))) {
    if (!slugs.has(dir)) rmSync(join(root, 'in', dir), { recursive: true });
  }
}
for (const suburb of suburbs) {
  const dir = join(root, 'in', suburb.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), suburbPage(suburb));
}

const urls = [`${SITE}/`, ...suburbs.map((s) => `${SITE}/in/${s.slug}/`)];
writeFileSync(join(root, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n');

console.log(`Wrote ${suburbs.length} suburb pages and sitemap.xml`);

if (withImages) await screenshotSuburbs();

// Static server with Range support, which PMTiles needs
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json' };
  const server = createServer((req, res) => {
    let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!path.startsWith(root) || !existsSync(path)) {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(path).size;
    const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      createReadStream(path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': size });
      createReadStream(path).pipe(res);
    }
  });
  return new Promise((done) => server.listen(0, () => done(server)));
}

async function screenshotSuburbs() {
  const { chromium } = await import('playwright-core');
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  await context.addInitScript(() => localStorage.setItem('introSeen', '1'));

  const queue = suburbs.filter((s) => !only || only.includes(s.slug));
  const worker = async () => {
    const page = await context.newPage();
    for (let suburb; (suburb = queue.shift());) {
      await page.goto(`${base}/in/${suburb.slug}/`);
      await page.waitForFunction(() => typeof map !== 'undefined' && map.loaded() && map.getLayer('jacarandas-point'));
      await page.evaluate(renderPreview, suburb);
      await page.screenshot({ path: join(root, 'in', suburb.slug, 'og.jpg'), type: 'jpeg', quality: 80 });
      console.log(`  ${suburb.name}`);
    }
    await page.close();
  };
  await Promise.all([worker(), worker(), worker()]);

  await browser.close();
  server.close();
}

// Runs in the page: outline the suburb, dim everything else, and add a title band
async function renderPreview(suburb) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const holes = suburb.geometry.coordinates.map((polygon) => polygon[0]);
  map.addSource('suburb', { type: 'geojson', data: { type: 'Feature', geometry: suburb.geometry } });
  map.addSource('suburb-mask', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } } });
  map.addLayer({ id: 'suburb-mask', type: 'fill', source: 'suburb-mask', paint: { 'fill-color': '#1e0b33', 'fill-opacity': 0.4 } });
  map.addLayer({ id: 'suburb-outline', type: 'line', source: 'suburb', paint: { 'line-color': '#6a1fb5', 'line-width': 3 } });

  document.querySelector('.maplibregl-control-container').style.display = 'none';
  const band = document.createElement('div');
  band.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:130px;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:0 48px;background:rgba(255,255,255,.95);font-family:system-ui,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,.15)';
  band.innerHTML = `
    <div>
      <div class="title" style="font-size:52px;font-weight:800;color:#6a1fb5;line-height:1.1"></div>
      <div class="count" style="font-size:26px;color:#333;margin-top:4px"></div>
    </div>
    <div style="font-size:24px;font-weight:600;color:#6a1fb5">jacarandas.com.au</div>`;
  band.querySelector('.title').textContent = `Jacarandas in ${suburb.name}`;
  band.querySelector('.count').textContent =
    `${suburb.count.toLocaleString('en-AU')} jacaranda${suburb.count === 1 ? '' : 's'} mapped`;
  document.body.appendChild(band);

  map.fitBounds(suburb.bbox, { padding: { top: 40, bottom: 170, left: 60, right: 60 }, maxZoom: 16, animate: false });
  await new Promise((done) => {
    map.once('idle', done);
    map.triggerRepaint();
  });
}
