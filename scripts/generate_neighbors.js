const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '../public/india_pc_2019_simplified.geojson');
if (!fs.existsSync(geojsonPath)) {
  console.error("GeoJSON file not found at:", geojsonPath);
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const features = geo.features || [];

console.log(`Processing ${features.length} constituencies for topological borders...`);

function getBBox(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function traverse(arr) {
    if (typeof arr[0] === 'number') {
      if (arr[0] < minX) minX = arr[0];
      if (arr[1] < minY) minY = arr[1];
      if (arr[0] > maxX) maxX = arr[0];
      if (arr[1] > maxY) maxY = arr[1];
    } else {
      for (const item of arr) traverse(item);
    }
  }
  traverse(coords);
  return [minX, minY, maxX, maxY];
}

function bboxOverlap(b1, b2) {
  return !(b2[0] > b1[2] || b2[2] < b1[0] || b2[1] > b1[3] || b2[3] < b1[1]);
}

function getPointSet(coords) {
  const set = new Set();
  function traverse(arr) {
    if (typeof arr[0] === 'number') {
      // 3 decimal places (~110m accuracy) is optimal for simplified vectors
      set.add(`${arr[0].toFixed(3)},${arr[1].toFixed(3)}`);
    } else {
      for (const item of arr) traverse(item);
    }
  }
  traverse(coords);
  return set;
}

const processed = features.map(f => {
  const p = f.properties || {};
  const name = p.PC_NAME || p.pc_name || p.name || '';
  const state = p.ST_NAME || p.st_name || p.state || '';
  const bbox = getBBox(f.geometry.coordinates);
  const points = getPointSet(f.geometry.coordinates);
  return { name: name.trim(), state: state.trim(), bbox, points };
});

const updates = [];

for (let i = 0; i < processed.length; i++) {
  const current = processed[i];
  if (!current.name) continue;
  
  const neighbors = new Set();

  for (let j = 0; j < processed.length; j++) {
    if (i === j) continue;
    const other = processed[j];
    if (!other.name || current.name.toLowerCase() === other.name.toLowerCase()) continue;

    // Fast reject via bounding box
    if (!bboxOverlap(current.bbox, other.bbox)) continue;

    // Strict boundary edge check: require >= 5 shared coordinate points
    let sharedVertices = 0;
    for (const pt of other.points) {
      if (current.points.has(pt)) {
        sharedVertices++;
        if (sharedVertices >= 5) {
          neighbors.add(other.name.replace(/'/g, "''"));
          break;
        }
      }
    }
  }

  const neighborArr = Array.from(neighbors);
  if (neighborArr.length > 0) {
    const formattedArray = "ARRAY['" + neighborArr.join("','") + "']";
    updates.push(
      `UPDATE public.constituency_master SET neighboring_seats = ${formattedArray} WHERE LOWER(TRIM(pc_name)) = LOWER(TRIM('${current.name.replace(/'/g, "''")}'));`
    );
  }
}

const sqlOutput = "BEGIN;\n\n" + updates.join("\n") + "\n\nCOMMIT;\n";
const outPath = path.join(__dirname, 'seed_neighbors_543.sql');
fs.writeFileSync(outPath, sqlOutput, 'utf8');

console.log(`✓ Clean regeneration complete! Generated updates for ${updates.length} seats at: scripts/seed_neighbors_543.sql`);