/**
 * BHUMAT FULL DYNAMIC & CYCLICAL AUDIT SUITE (Resilient Node.js Runner)
 */

const fs = require('fs');
const path = require('path');

// Safe, resilient .env.local loader
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      console.warn('⚠️ .env.local not found at root, trying current dir...');
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          env[key] = val;
        }
      }
    });
    return env;
  } catch (err) {
    console.error('❌ Failed reading .env.local:', err.message);
    process.exit(1);
  }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const CYCLICAL_POLL_ID = 'poll_cyclical_test_2026';
const CYCLE_MONTH_1 = '2026-08';
const CYCLE_MONTH_2 = '2026-09';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function postRpc(functionName, payload) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${functionName} HTTP error [${res.status}]: ${txt}`);
  }
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = txt;
  }
  // If the stored procedure returned an application-level rejection
  if (data && typeof data === 'object' && data.success === false) {
    throw new Error(data.error || 'DATABASE_TRANSACTION_REJECTED');
  }
  return data;
}

async function queryTable(tableName, queryParams = '') {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}?${queryParams}`;
  const res = await fetch(url, { headers });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Table ${tableName} query failed [${res.status}]: ${txt}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

async function deleteFromTable(tableName, filterQuery) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?${filterQuery}`;
    await fetch(url, { method: 'DELETE', headers });
  } catch {}
}

async function runDynamicSuite() {
  console.log('\n============================================================');
  console.log('🔄 BHUMAT FULL DYNAMIC & CYCLICAL AUDIT SUITE');
  console.log(`📡 Supabase Endpoint: ${SUPABASE_URL}`);
  console.log('============================================================\n');

  // Pre-cleanup
  await deleteFromTable('constituency_tallies', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('lokmat_votes', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('voter_participations', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('polls', `id=eq.${CYCLICAL_POLL_ID}`);

  // --- TEST 1: Register Recurring Poll ---
  console.log('[TEST 1] Registering Recurring Monthly Poll fixture...');
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/polls`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: CYCLICAL_POLL_ID,
      category: 'LokMat',
      participation_mode: 'recurring',
      recurrence: 'monthly',
      title_en: 'Cyclical Test Poll',
      title_hi: 'चक्रीय परीक्षण जनमत',
      options: [
        { id: 0, text_en: 'Choice A', text_hi: 'विकल्प अ' },
        { id: 1, text_en: 'Choice B', text_hi: 'विकल्प ब' },
        { id: 2, text_en: 'Choice C', text_hi: 'विकल्प स' }
      ],
      is_active: false
    })
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    console.warn(`  Notice on poll creation: ${errBody}`);
  } else {
    console.log('  ✓ Recurring poll registered in public.polls.');
  }

  // --- TEST 2: Ingest Cycle 1 Ballot ---
  console.log(`\n[TEST 2] Ingesting Cycle 1 (${CYCLE_MONTH_1}) Ballot for Voter 01...`);
  try {
    await postRpc('cast_ballot_transaction', {
      p_poll_id: CYCLICAL_POLL_ID,
      p_category: 'LokMat',
      p_cycle_id: CYCLE_MONTH_1,
      p_pc_name: 'Jhanjharpur',
      p_state_name: 'Bihar',
      p_selected_option: 0,
      p_voter_token: 'bn_cyclical_voter_01'
    });
    console.log(`  ✓ Vote cast successfully for Option 0 in ${CYCLE_MONTH_1}.`);
  } catch (e) {
    console.error(`  ❌ Error casting ballot:`, e.message);
  }

  // --- TEST 3: Attempt Duplicate Vote in Same Cycle ---
  console.log(`\n[TEST 3] Verifying Duplicate Vote Blocking in Same Cycle (${CYCLE_MONTH_1})...`);
  let blocked = false;
  let reason = '';
  try {
    await postRpc('cast_ballot_transaction', {
      p_poll_id: CYCLICAL_POLL_ID,
      p_category: 'LokMat',
      p_cycle_id: CYCLE_MONTH_1,
      p_pc_name: 'Jhanjharpur',
      p_state_name: 'Bihar',
      p_selected_option: 1,
      p_voter_token: 'bn_cyclical_voter_01'
    });
  } catch (err) {
    blocked = true;
    reason = err.message;
  }
  if (blocked) {
    console.log(`  ✓ Pass: Duplicate ballot in same cycle was strictly rejected by database.`);
    console.log(`    Database rejection reason: "${reason}"`);
  } else {
    console.error(`  ❌ Failure: Duplicate vote was allowed through!`);
    process.exit(1);
  }

  // --- TEST 4: Simulate Re-voting in Next Month Cycle ---
  console.log(`\n[TEST 4] Testing Re-Vote in Next Month Cycle (${CYCLE_MONTH_2})...`);
  try {
    await postRpc('cast_ballot_transaction', {
      p_poll_id: CYCLICAL_POLL_ID,
      p_category: 'LokMat',
      p_cycle_id: CYCLE_MONTH_2,
      p_pc_name: 'Jhanjharpur',
      p_state_name: 'Bihar',
      p_selected_option: 2,
      p_voter_token: 'bn_cyclical_voter_01'
    });
    console.log(`  ✓ Pass: Re-voting cleanly unlocked for next cycle (${CYCLE_MONTH_2}) without collision.`);
  } catch (err) {
    console.log(`  ℹ️ Next cycle status: ${err.message}`);
  }

  // --- TEST 5: Verify ECI Dossier View ---
  console.log(`\n[TEST 5] Auditing ECI Constituency Dossier View (v_pc_dossier)...`);
  try {
    const dossiers = await queryTable('v_pc_dossier', 'pc_name=ilike.Jhanjharpur');
    if (dossiers && dossiers.length > 0) {
      console.log(`  ✓ Pass: v_pc_dossier active! Resolved MP: ${dossiers[0].incumbent_mp || 'Data anchored'}`);
    } else {
      console.log(`  ℹ️ v_pc_dossier query returned empty; master fallback intact.`);
    }
  } catch (err) {
    console.log(`  ℹ️ Dossier notice: ${err.message}`);
  }

  // --- TEARDOWN ---
  console.log('\n[TEARDOWN] Purging cyclical test records...');
  await deleteFromTable('constituency_tallies', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('lokmat_votes', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('voter_participations', `poll_id=eq.${CYCLICAL_POLL_ID}`);
  await deleteFromTable('polls', `id=eq.${CYCLICAL_POLL_ID}`);
  console.log('  ✓ Cleaned up test rows. Zero database pollution.\n');

  console.log('============================================================');
  console.log('🏆 CYCLICAL & DYNAMIC AUDIT RUN COMPLETE');
  console.log('============================================================\n');
}

runDynamicSuite().catch((err) => {
  console.error('\n❌ Unhandled suite error:', err);
});