const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'india_pc_2019_simplified.geojson');
const outputPath = path.join(__dirname, 'public', 'india_pc_preprojected.json');

console.log('Reading:', inputPath);
if (!fs.existsSync(inputPath)) {
  console.error('ERROR: Missing public/india_pc_2019_simplified.geojson');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Desired SVG Canvas
const CANVAS_W = 800;
const CANVAS_H = 950;
const PADDING = 30; // 30px breathing room around edges

// Standard Mercator projection to raw mathematical coordinates
function rawMercator(lon, lat) {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const x = lambda;
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return [x, y];
}

// Pass 1: Find true bounding box of Mainland India (excluding remote island coordinates)
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

raw.features.forEach(f => {
  const p = f.properties || {};
  const st = String(p.ST_NAME || p.st_name || p.STATE || '').toLowerCase();
  if (st.includes('andaman') || st.includes('lakshadweep')) return;

  function scanCoords(coords) {
    if (typeof coords[0] === 'number') {
      const [x, y] = rawMercator(coords[0], coords[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      coords.forEach(scanCoords);
    }
  }

  if (f.geometry && f.geometry.coordinates) {
    scanCoords(f.geometry.coordinates);
  }
});

// Pass 2: Calculate exact scale and translation to fill the canvas
const dataW = maxX - minX;
const dataH = maxY - minY;

const scaleX = (CANVAS_W - PADDING * 2) / dataW;
const scaleY = (CANVAS_H - PADDING * 2) / dataH;
const scale = Math.min(scaleX, scaleY);

const midX = (minX + maxX) / 2;
const midY = (minY + maxY) / 2;

function project(lon, lat) {
  const [rx, ry] = rawMercator(lon, lat);
  // Transform to SVG coordinates (SVG y is inverted)
  const px = (CANVAS_W / 2) + (rx - midX) * scale;
  const py = (CANVAS_H / 2) - (ry - midY) * scale;
  return [Number(px.toFixed(1)), Number(py.toFixed(1))];
}

function ringToPath(ring) {
  if (!ring || ring.length < 3) return '';
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const pt = project(ring[i][0], ring[i][1]);
    d += (i === 0 ? 'M' : 'L') + pt[0] + ' ' + pt[1];
  }
  return d + 'Z';
}

function geometryToPath(geom) {
  if (!geom) return '';
  let d = '';
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) d += ringToPath(ring);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) d += ringToPath(ring);
    }
  }
  return d;
}

console.log(`Auto-fitting ${raw.features.length} seats to ${CANVAS_W}x${CANVAS_H}...`);

const preprojected = raw.features.map((f, idx) => {
  const p = f.properties || {};
  const rawName = String(p.PC_NAME || p.pc_name || p.NAME || p.name || `Seat_${idx}`).trim();
  const rawState = String(p.ST_NAME || p.st_name || p.STATE || p.state || 'India').trim();
  
  const cleanState = rawState.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSeat = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = `${cleanSeat}_${cleanState || idx}`;
  
  const d = geometryToPath(f.geometry);
  return { id, name: rawName, state: rawState, d };
}).filter(seat => seat.d.length > 0);

fs.writeFileSync(outputPath, JSON.stringify(preprojected));
console.log(`SUCCESS: Bounded ${preprojected.length} seats cleanly inside the canvas.`);