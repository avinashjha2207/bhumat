const fs = require('fs');
const path = require('path');

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

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\((sc\vert{}st)\)/gi, '')
    .replace(/\s*\[(sc\vert{}st)\]/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// --- 1. Parse Crosswalk ---
const crosswalkLines = fs.readFileSync(crosswalkPath, 'utf-8').split(/\r?\n/).filter(Boolean);
const rawFirstLine = crosswalkLines[0];
const cwHeaders = parseCsvLine(rawFirstLine).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

console.log('Crosswalk Headers Detected:', cwHeaders);

// Search for any column name matching PC, AC Name, and AC Number
let pcNameIdx = cwHeaders.findIndex(h => h.includes('pcname') || h === 'pc');
let acNameIdx = cwHeaders.findIndex(h => h.includes('acname') || h.includes('assemblyname'));
let acNoIdx = cwHeaders.findIndex(h => h.includes('acno') || h.includes('acnum') || h.includes('assemblyno') || h.includes('acid') || h.includes('constituencyno'));

// Fallbacks if header naming is non-standard:
if (pcNameIdx === -1) pcNameIdx = 4;
if (acNameIdx === -1) acNameIdx = 7;
if (acNoIdx === -1) {
  // If no header matches, search row 1 for the numeric assembly column index
  const sampleParts = parseCsvLine(crosswalkLines[1]);
  acNoIdx = sampleParts.findIndex((p, idx) => idx !== pcNameIdx && idx !== acNameIdx && /^\d+$/.test(p.trim()));
  if (acNoIdx === -1) acNoIdx = 2; // Default position
}

console.log(`Resolved Column Indices: PC_Name=${pcNameIdx}, AC_Name=${acNameIdx}, AC_No=${acNoIdx}`);

const pcAcMap = new Map();

for (let i = 1; i < crosswalkLines.length; i++) {
  const parts = parseCsvLine(crosswalkLines[i]);
  if (parts.length <= Math.max(pcNameIdx, acNameIdx)) continue;

  const rawPc = parts[pcNameIdx]?.replace(/"/g, '');
  const rawAc = parts[acNameIdx]?.replace(/"/g, '');
  let rawAcNo = parts[acNoIdx]?.replace(/"/g, '');

  let acNumber = parseInt(rawAcNo, 10);
  if (isNaN(acNumber)) {
    // If the selected column isn't a number, scan the row for the first pure digit
    const foundNum = parts.find(p => /^\d+$/.test(p.trim()));
    acNumber = foundNum ? parseInt(foundNum, 10) : i;
  }

  const normPc = normalize(rawPc);

  if (normPc && rawAc) {
    if (!pcAcMap.has(normPc)) {
      pcAcMap.set(normPc, []);
    }
    const list = pcAcMap.get(normPc);
    if (!list.some(item => item.acNo === acNumber || item.acName.toLowerCase() === rawAc.toLowerCase())) {
      list.push({ acNo: acNumber, acName: rawAc, reservation: 'GEN' });
    }
  }
}

// --- 2. Parse 2024 Winners ---
const winnersLines = fs.readFileSync(winnersPath, 'utf-8').split(/\r?\n/).filter(Boolean);
const wHeaders = parseCsvLine(winnersLines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

const wStateIdx = Math.max(0, wHeaders.findIndex(h => h.includes('state')));
const wPcNoIdx = wHeaders.findIndex(h => h.includes('pcno') || h.includes('pcnumber'));
const wPcNameIdx = wHeaders.findIndex(h => h.includes('pcname'));
const wWinnerIdx = wHeaders.findIndex(h => h.includes('winningcandidate') || h.includes('candidate'));
const wPartyIdx = wHeaders.findIndex(h => h.includes('winningparty') || h.includes('party'));
const wRunnerIdx = wHeaders.findIndex(h => h.includes('runnerupcandidate') || h.includes('runnerup'));
const wRunnerPartyIdx = wHeaders.findIndex(h => h.includes('runnerupparty'));
const wMarginIdx = wHeaders.findIndex(h => h.includes('margin'));

const masterRows = [];
const vidhanSabhaRows = [];
const seenPcIds = new Set();
const seenAcIds = new Set();

for (let i = 1; i < winnersLines.length; i++) {
  const parts = parseCsvLine(winnersLines[i]);
  if (parts.length < 3) continue;

  const state = parts[wStateIdx !== -1 ? wStateIdx : 0]?.replace(/"/g, '').trim() || 'India';
  const pcNo = parts[wPcNoIdx !== -1 ? wPcNoIdx : 1]?.replace(/"/g, '').trim() || String(i);
  const pcNameRaw = parts[wPcNameIdx !== -1 ? wPcNameIdx : 2]?.replace(/"/g, '').trim() || `Seat_${i}`;
  const winnerName = parts[wWinnerIdx !== -1 ? wWinnerIdx : 3]?.replace(/"/g, '').trim() || '';
  const winnerParty = parts[wPartyIdx !== -1 ? wPartyIdx : 4]?.replace(/"/g, '').trim() || '';
  const runnerName = parts[wRunnerIdx !== -1 ? wRunnerIdx : 5]?.replace(/"/g, '').trim() || '';
  const runnerParty = parts[wRunnerPartyIdx !== -1 ? wRunnerPartyIdx : 6]?.replace(/"/g, '').trim() || '';
  const margin = parts[wMarginIdx !== -1 ? wMarginIdx : 7]?.replace(/"/g, '').trim() || '0';

  const statePrefix = (state || 'IN').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  const pcId = `${statePrefix}-${pcNo}`;
  const pcCode = `${pcNo}-${statePrefix}`;

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

    const normKey = normalize(pcNameRaw);
    const segments = pcAcMap.get(normKey) || [];

    segments.forEach((seg, sIdx) => {
      const uniqueAcNum = seg.acNo || (sIdx + 1);
      const acId = `${pcId}-AC-${uniqueAcNum}`;
      if (!seenAcIds.has(acId)) {
        seenAcIds.add(acId);
        vidhanSabhaRows.push({
          ac_id: acId,
          pc_id: pcId,
          ac_number: uniqueAcNum,
          ac_name: seg.acName,
          reservation_type: seg.reservation || 'GEN'
        });
      }
    });
  }
}

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
console.log(`📁 constituency_master: ${masterRows.length} unique Lok Sabha seats`);
console.log(`📁 vidhan_sabha_segments: ${vidhanSabhaRows.length} unique Vidhan Sabha segments`);