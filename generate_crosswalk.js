const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const turf = require('@turf/turf');

async function run() {
  console.log('----------------------------------------------------');
  console.log('   BHUMAT SOVEREIGN SPATIAL ENGINE - BATCH CROSSWALK ');
  console.log('----------------------------------------------------');

  // 1. Load 543 Lok Sabha Boundaries
  let geoPath = path.join('public', 'india_pc_2019_simplified.geojson');
  if (!fs.existsSync(geoPath)) {
    geoPath = 'india_pc_2019_simplified.geojson';
  }

  if (!fs.existsSync(geoPath)) {
    console.error('Error: Cannot find india_pc_2019_simplified.geojson in public/ or root.');
    process.exit(1);
  }

  console.log('1. Loading 543 Lok Sabha boundaries...');
  const geoRaw = fs.readFileSync(geoPath, 'utf8');
  const geojson = JSON.parse(geoRaw);

  // Pre-calculate Bounding Box (BBox) for each constituency to accelerate lookups
  const indexedFeatures = geojson.features.map((feature, idx) => {
    const bbox = turf.bbox(feature); // [minX, minY, maxX, maxY]
    const p = feature.properties || {};
    const pcName = p.PC_NAME || p.pc_name || p.NAME || `Constituency_${idx}`;
    const stName = p.ST_NAME || p.st_name || p.STATE || '';
    return {
      feature,
      bbox,
      pcName: pcName.trim(),
      stName: stName.trim()
    };
  });
  console.log(`   Indexed ${indexedFeatures.length} Parliamentary Constituencies with BBox filters.`);

  // 2. Locate Postal Directory CSV
  console.log('2. Locating India Post directory CSV...');
  const files = fs.readdirSync('.');
  const targetCsv = files.find(f => 
    f.toLowerCase().includes('all_india_pincode') || 
    f.toLowerCase().includes('pincode_directory')
  );

  if (!targetCsv) {
    console.error('Error: Could not find all_india_pincode_directory CSV in project root.');
    process.exit(1);
  }
  console.log(`   Selected Source: ${targetCsv}`);

  const pinMap = new Map();
  let totalRows = 0;
  let matchedPoints = 0;

  console.log('3. Executing Point-in-Polygon spatial intersection...');
  const startTime = Date.now();

  fs.createReadStream(targetCsv)
    .pipe(csv())
    .on('data', (row) => {
      totalRows++;

      const keys = Object.keys(row);
      const pinKey = keys.find(k => k.toLowerCase().includes('pin'));
      const latKey = keys.find(k => k.toLowerCase().includes('lat'));
      const lonKey = keys.find(k => k.toLowerCase().includes('lon') || k.toLowerCase().includes('lng'));
      const distKey = keys.find(k => k.toLowerCase().includes('dist'));
      const stateKey = keys.find(k => k.toLowerCase().includes('state'));

      const pincode = row[pinKey]?.trim();
      const lat = parseFloat(row[latKey]);
      const lon = parseFloat(row[lonKey]);
      const district = row[distKey]?.trim() || '';
      const state = row[stateKey]?.trim() || '';

      if (!pincode || pincode.length !== 6 || isNaN(lat) || isNaN(lon)) return;
      if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) return;

      const pt = turf.point([lon, lat]);

      // Fast check: Match against BBox first, then perform exact polygon geometry test
      for (const item of indexedFeatures) {
        const [minX, minY, maxX, maxY] = item.bbox;
        if (lon >= minX && lon <= maxX && lat >= minY && lat <= maxY) {
          if (turf.booleanPointInPolygon(pt, item.feature)) {
            matchedPoints++;
            if (!pinMap.has(pincode)) {
              pinMap.set(pincode, {
                seats: new Set([item.pcName]),
                state: item.stName || state,
                district: district
              });
            } else {
              pinMap.get(pincode).seats.add(item.pcName);
            }
            break; // Matched point to its enclosing Lok Sabha seat
          }
        }
      }

      if (totalRows % 10000 === 0) {
        process.stdout.write(`\r   Read ${totalRows} rows | Matched points: ${matchedPoints}...`);
      }
    })
    .on('end', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n   Completed in ${elapsed}s.`);

      console.log('4. Compiling Crosswalk Artifacts...');

      const jsonOutput = {};
      const csvRows = ['pincode,district_name,state_name,pc_name,is_overlap'];
      let singleCount = 0;
      let overlapCount = 0;

      for (const [pin, data] of pinMap.entries()) {
        const seatList = Array.from(data.seats);
        const isOverlap = seatList.length > 1;

        if (isOverlap) overlapCount++;
        else singleCount++;

        jsonOutput[pin] = {
          seats: seatList,
          state: data.state,
          district: data.district,
          is_overlap: isOverlap
        };

        for (const seat of seatList) {
          csvRows.push(`"${pin}","${data.district}","${data.state}","${seat}",${isOverlap}`);
        }
      }

      console.log('====================================================');
      console.log(`TOTAL UNIQUE PIN CODES RESOLVED: ${pinMap.size}`);
      console.log(`1. Single Constituency (Auto-Lock): ${singleCount}`);
      console.log(`2. Multi-Constituency Overlaps:     ${overlapCount}`);
      console.log('====================================================');

      // 1. Save frontend client-side dictionary in public/
      const jsonDest = path.join('public', 'pincode_pc_crosswalk.json');
      fs.writeFileSync(jsonDest, JSON.stringify(jsonOutput));
      console.log(`✓ Saved Client JSON: ${jsonDest}`);

      // 2. Save Supabase CSV table
      fs.writeFileSync('master_pincode_crosswalk.csv', csvRows.join('\n'));
      console.log(`✓ Saved Supabase CSV: master_pincode_crosswalk.csv`);
      console.log('Done!');
    });
}

run();