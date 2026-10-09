const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Find the available spatial file in the root directory
const targetFiles = [
  'BhuMat master_spatial - Master_Pincode_State_Dist.csv',
  'BhuMat master_spatial - Master_Pincode_S.csv',
  'master_spatial.csv'
];

let activeFile = null;
for (const f of fs.readdirSync('.')) {
  if (f.toLowerCase().includes('master_pincode') || f.toLowerCase().includes('master_spatial')) {
    activeFile = f;
    break;
  }
}

if (!activeFile) {
  console.error('Could not find master spatial CSV file in root.');
  process.exit(1);
}

console.log(`Reading spatial data from: ${activeFile}`);

async function run() {
  const fileStream = fs.createReadStream(activeFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = [];
  let batch = [];
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parts = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());

    if (headers.length === 0) {
      headers = parts.map(h => h.toLowerCase());
      continue;
    }

    const pinIdx = headers.findIndex(h => h.includes('pin'));
    const distIdx = headers.findIndex(h => h.includes('dist'));
    const stateIdx = headers.findIndex(h => h.includes('state'));
    const pcIdx = headers.findIndex(h => h.includes('pc') || h.includes('parliament') || h.includes('assigned_pc'));

    const pincode = parts[pinIdx];
    const district_name = distIdx >= 0 ? parts[distIdx] : '';
    const state_name = stateIdx >= 0 ? parts[stateIdx] : '';
    const pc_name = pcIdx >= 0 ? parts[pcIdx] : '';

    if (pincode && pincode.length === 6 && pc_name && !pc_name.toLowerCase().includes('select')) {
      batch.push({
        pincode,
        district_name,
        state_name,
        pc_name,
        is_overlap: false
      });
    }

    if (batch.length >= 500) {
      const { error } = await supabase.from('master_pincode_crosswalk').upsert(batch, { onConflict: 'pincode,pc_name' });
      if (error) console.error('Batch error:', error.message);
      else count += batch.length;
      process.stdout.write(`\rIngested ${count} verified PIN mappings...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await supabase.from('master_pincode_crosswalk').upsert(batch, { onConflict: 'pincode,pc_name' });
    count += batch.length;
  }

  console.log(`\nDone. Total verified PINs synced: ${count}`);
}

run();