const fs = require('fs');
const path = require('path');

// Recursive search starting from workspace root
function findFile(dir, targetName) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFile(fullPath, targetName);
        if (found) return found;
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.includes('india ac') && lower.endsWith('.csv')) {
          return fullPath;
        }
      }
    }
  } catch (e) {}
  return null;
}

// Check current dir, parent dir, and subfolders
let csvPath = findFile(path.resolve(__dirname, '..'), 'india ac');
if (!csvPath) {
  csvPath = findFile(process.cwd(), 'india ac');
}

if (!csvPath) {
  console.error("❌ Could not locate the CSV file automatically.");
  console.error("Please drag 'BhuMat India AC - India AC (1).csv' directly into your 'scripts' folder and re-run.");
  process.exit(1);
}

console.log("✓ Found CSV at:", csvPath);

const rawCsv = fs.readFileSync(csvPath, 'utf8');
const lines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);

function parseCsvLine(text) {
  const result = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cell.trim().replace(/^"|"$/g, ''));
      cell = '';
    } else {
      cell += c;
    }
  }
  result.push(cell.trim().replace(/^"|"$/g, ''));
  return result;
}

let sql = "BEGIN;\n";
sql += `CREATE TABLE IF NOT EXISTS public.assembly_constituencies (
    id SERIAL PRIMARY KEY,
    state_ut VARCHAR(60) NOT NULL,
    pc_name VARCHAR(100) NOT NULL,
    ac_number INT NOT NULL,
    ac_name VARCHAR(100) NOT NULL,
    reservation_status VARCHAR(10) DEFAULT 'GEN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_state_ac UNIQUE (state_ut, ac_number, ac_name)
);\n\n`;

let count = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < 4) continue;

  const state = cols[0] ? cols[0].replace(/'/g, "''").trim() : '';
  const pcName = cols[1] ? cols[1].replace(/'/g, "''").trim() : '';
  const acNo = parseInt(cols[2], 10);
  const acName = cols[3] ? cols[3].replace(/'/g, "''").trim() : '';
  const reservation = cols[4] ? cols[4].replace(/'/g, "''").trim() : 'GEN';

  if (!state || !pcName || isNaN(acNo) || !acName) continue;

  sql += `INSERT INTO public.assembly_constituencies (state_ut, pc_name, ac_number, ac_name, reservation_status) VALUES ('${state}', '${pcName}', ${acNo}, '${acName}', '${reservation}') ON CONFLICT (state_ut, ac_number, ac_name) DO NOTHING;\n`;
  count++;
}

sql += "\nCOMMIT;\n";

const outPath = path.resolve(__dirname, 'seed_assembly_constituencies.sql');
fs.writeFileSync(outPath, sql, 'utf8');

console.log(`✓ Success! Generated ${outPath} with ${count} Assembly Constituencies.`);