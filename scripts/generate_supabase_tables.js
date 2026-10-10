const fs = require('fs');
const path = require('path');

// Auto-detect public/data path whether in root or app/
let dataDir = path.join(__dirname, '../public/data');
if (!fs.existsSync(dataDir)) {
  dataDir = path.join(__dirname, '../../public/data');
}

const crosswalkPath = path.join(dataDir, 'raw_pc_ac_crosswalk.csv');
const winnersPath = path.join(dataDir, 'raw_2024_winners.csv');

if (!fs.existsSync(crosswalkPath) || !fs.existsSync(winnersPath)) {
  console.error('❌ Missing raw CSV files in public/data');
  process.exit(1);
}

// 1. Build Unique AC Crosswalk map
const crosswalkLines = fs.readFileSync(crosswalkPath, 'utf-8').split('\n').filter(Boolean);
const pcAcMap = {}; 

crosswalkLines.slice(1).forEach((line) => {
  const parts = line.split(',');
  if (parts.length >= 6) {
    const pcNameKey = parts[2].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const acNo = parseInt(parts[3].trim(), 10);
    const acName = parts[4].trim();
    const reservation = parts[5].trim();

    if (!pcAcMap[pcNameKey]) {
      pcAcMap[pcNameKey] = [];
    }
    
    // Avoid duplicate assembly entries in crosswalk
    if (!pcAcMap[pcNameKey].some(s => s.acNo === acNo)) {
      pcAcMap[pcNameKey].push({ acNo, acName, reservation });
    }
  }
});

// 2. Build Master & Segment Rows with strict Set Deduplication
const winnersLines = fs.readFileSync(winnersPath, 'utf-8').split('\n').filter(Boolean);
const masterRows = [];
const vidhanSabhaRows = [];
const seenPcIds = new Set();
const seenAcIds = new Set();

winnersLines.slice(1).forEach((line) => {
  const parts = line.split(',');
  if (parts.length >= 6) {
    const state = parts[0]?.replace(/"/g, '').trim();
    const pcNo = parts[1]?.replace(/"/g, '').trim();
    const pcNameRaw = parts[2]?.replace(/"/g, '').trim();
    const winnerName = parts[3]?.replace(/"/g, '').trim();
    const winnerParty = parts[4]?.replace(/"/g, '').trim();
    const runnerName = parts[5]?.replace(/"/g, '').trim();
    const runnerParty = parts[6]?.replace(/"/g, '').trim();
    const margin = parts[7]?.replace(/"/g, '').trim() || '0';

    const pcKey = (pcNameRaw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const statePrefix = (state || 'IN').slice(0, 2).toUpperCase();
    const pcId = `${statePrefix}-${pcNo || '0'}`;
    const pcCode = `${pcNo || '0'}-${statePrefix}`;

    // Deduplicate PC entries
    if (!seenPcIds.has(pcId)) {
      seenPcIds.add(pcId);
      masterRows.push({
        pc_id: pcId,
        pc_code: pcCode,
        pc_name: pcNameRaw,
        state: state,
        mp_name: winnerName,
        mp_party: winnerParty,
        runner_up_name: runnerName,
        runner_up_party: runnerParty,
        winning_margin: margin
      });

      // Insert segments only once per PC
      const segments = pcAcMap[pcKey] || [];
      segments.forEach((seg) => {
        const acId = `${pcId}-AC-${seg.acNo}`;
        if (!seenAcIds.has(acId)) {
          seenAcIds.add(acId);
          vidhanSabhaRows.push({
            ac_id: acId,
            pc_id: pcId,
            ac_number: seg.acNo,
            ac_name: seg.acName,
            reservation_type: seg.reservation || 'GEN'
          });
        }
      });
    }
  }
});

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push(headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','));
  });
  return lines.join('\n');
}

const masterCsvPath = path.join(dataDir, 'supabase_constituency_master.csv');
const acCsvPath = path.join(dataDir, 'supabase_vidhan_sabha_segments.csv');

fs.writeFileSync(masterCsvPath, toCsv(masterRows));
fs.writeFileSync(acCsvPath, toCsv(vidhanSabhaRows));

console.log('✅ Clean deduplicated CSVs generated!');
console.log(`📁 constituency_master: ${masterRows.length} unique rows`);
console.log(`📁 vidhan_sabha_segments: ${vidhanSabhaRows.length} unique rows`);