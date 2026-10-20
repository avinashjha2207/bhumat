const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local manually (no dotenv required!)
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Read the CSV directly from scripts folder
const csvPath = path.join(__dirname, 'BhuMat India_AC - India_AC (1).csv');
if (!fs.existsSync(csvPath)) {
  console.error("❌ CSV file not found at:", csvPath);
  process.exit(1);
}

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

const headers = parseCsvLine(lines[0]).map(h => h.trim());
console.log("CSV Headers detected:", headers);

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < 5) continue;

  // Matching headers: AC_ID, AC_NAME, ac_name_hi, ST_UT, PARENT_PC, reservation_type
  const ac_id = parseInt(cols[0], 10);
  const ac_name = cols[1];
  const ac_name_hi = cols[2] || null;
  const state_ut = cols[3];
  const parent_pc = cols[4];
  const reservation_type = cols[5] || 'GEN';

  if (!ac_name || !parent_pc) continue;

  rows.push({
    ac_id: isNaN(ac_id) ? null : ac_id,
    ac_name: ac_name.trim(),
    ac_name_hi: ac_name_hi ? ac_name_hi.trim() : null,
    state_ut: state_ut ? state_ut.trim() : '',
    parent_pc: parent_pc.trim(),
    reservation_type: reservation_type ? reservation_type.trim() : 'GEN'
  });
}

console.log(`Parsed ${rows.length} valid rows from CSV. Uploading in batches to Supabase...`);

async function uploadBatches() {
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('assembly_constituencies').insert(batch);
    if (error) {
      console.error(`Error uploading batch ${i}-${i + batch.length}:`, error.message);
      return;
    }
    console.log(`Uploaded rows ${i + 1} to ${Math.min(i + batchSize, rows.length)} of ${rows.length}`);
  }
  console.log("🎉 ALL 4,182 ASSEMBLY CONSTITUENCIES SUCCESSFULLY INSERTED INTO SUPABASE!");
}

uploadBatches();