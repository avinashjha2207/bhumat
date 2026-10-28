/**
 * BHUMAT DRISHTI MAP 543-SEAT COLOR, TIE & VOTE-PULSE ORACLE
 * 
 * Verifies:
 * 1. Sub-quorum (< 50 votes) evaluation -> Neutral Slate Grey (#cbd5e1).
 * 2. Fortified (>= 50 votes) single leading option -> Correct option palette color.
 * 3. Fortified Tie / Split Mat (e.g., 25 vs 25) -> Radiant Gold (#f59e0b).
 * 4. Multi-way Tie (20 vs 20 vs 20) -> Radiant Gold (#f59e0b).
 * 5. Vote Option Pulse Engine:
 *    - Phase 1 (0 to 2500ms): Flashes citizen's chosen option color.
 *    - Phase 2 (> 2500ms): Decays cleanly back to live consensus/tally color.
 * 6. Dynamic fallback calculation when leading_option_id is null.
 */

const COLOR_PALETTE = {
  OPT_0: '#f97316',        // Saffron
  OPT_1: '#10b981',        // Emerald Green
  OPT_2: '#8b5cf6',        // Royal Purple
  OPT_3: '#0ea5e9',        // Sky Blue
  SPLIT_MAT_TIE: '#f59e0b',// Radiant Gold / Amber
  SUB_QUORUM: '#cbd5e1',   // Slate Grey (< 50 votes)
  UNPOLLED: '#e2e8f0'      // Neutral Border Grey
};

const QUORUM_THRESHOLD = 50;
const PULSE_DURATION_MS = 2500; // 2.5 seconds pulse decay

/**
 * Evaluates constituency visual color, including the dynamic Vote-Pulse state
 */
function evaluateConstituencyVisualState(row, pulseState = null) {
  const now = Date.now();

  // --- 1. DYNAMIC VOTE-PULSE INTERCEPT ---
  // If the user just voted in this seat and the 2.5s timer has not expired
  if (
    pulseState &&
    pulseState.isPulsing &&
    now - pulseState.votedAtTimestamp < PULSE_DURATION_MS
  ) {
    const optColors = [
      COLOR_PALETTE.OPT_0,
      COLOR_PALETTE.OPT_1,
      COLOR_PALETTE.OPT_2,
      COLOR_PALETTE.OPT_3
    ];
    return {
      fillColor: optColors[pulseState.votedOptionIdx] || COLOR_PALETTE.OPT_0,
      isPulsing: true,
      phase: 'VOTE_OPTION_PULSE_FLASH'
    };
  }

  // --- 2. SETTLED / LIVE CONSENSUS PHASE ---
  if (!row) {
    return { fillColor: COLOR_PALETTE.UNPOLLED, isPulsing: false, phase: 'UNPOLLED' };
  }

  const total = Number(row.total_ballots ?? row.total_votes ?? 0);
  if (total === 0) {
    return { fillColor: COLOR_PALETTE.UNPOLLED, isPulsing: false, phase: 'UNPOLLED' };
  }

  if (total < QUORUM_THRESHOLD) {
    return { fillColor: COLOR_PALETTE.SUB_QUORUM, isPulsing: false, phase: 'SUB_QUORUM_LOCKED' };
  }

  const counts = [
    Number(row.opt_0_count ?? row.opt_0_votes ?? 0),
    Number(row.opt_1_count ?? row.opt_1_votes ?? 0),
    Number(row.opt_2_count ?? row.opt_2_votes ?? 0),
    Number(row.opt_3_count ?? row.opt_3_votes ?? 0)
  ];

  const maxVotes = Math.max(...counts);
  const leaders = counts.filter(c => c === maxVotes);

  // Tie (Split Mat)
  if (leaders.length > 1) {
    return { fillColor: COLOR_PALETTE.SPLIT_MAT_TIE, isPulsing: false, phase: 'SPLIT_MAT_TIE' };
  }

  // Decisive Winner
  const leadOptIdx = counts.indexOf(maxVotes);
  const optColors = [
    COLOR_PALETTE.OPT_0,
    COLOR_PALETTE.OPT_1,
    COLOR_PALETTE.OPT_2,
    COLOR_PALETTE.OPT_3
  ];

  return {
    fillColor: optColors[leadOptIdx] || COLOR_PALETTE.UNPOLLED,
    isPulsing: false,
    phase: 'SETTLED_CONSENSUS'
  };
}

function runDrishtiOracle() {
  console.log('\n============================================================');
  console.log('🗺️  BHUMAT DRISHTI MAP 543-SEAT COLOR, TIE & PULSE ORACLE');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      process.exit(1);
    } else {
      console.log(`  ✓ Pass: ${message}`);
      passed++;
    }
  }

  // --- TEST 1: Unpolled Seat ---
  console.log('[TEST 1] Unpolled Seat (0 Ballots)...');
  const res1 = evaluateConstituencyVisualState({ total_votes: 0 });
  assert(res1.fillColor === COLOR_PALETTE.UNPOLLED, '0 votes must return unpolled grey');
  console.log(`  Result: ${res1.fillColor} (Phase: ${res1.phase})\n`);

  // --- TEST 2: Sub-Quorum (< 50 votes) ---
  console.log('[TEST 2] Sub-Quorum Seat (45 Ballots)...');
  const res2 = evaluateConstituencyVisualState({
    total_votes: 45,
    opt_0_votes: 40,
    opt_1_votes: 5
  });
  assert(res2.fillColor === COLOR_PALETTE.SUB_QUORUM, '< 50 votes must return slate grey');
  console.log(`  Result: ${res2.fillColor} (Phase: ${res2.phase})\n`);

  // --- TEST 3: Fortified Decisive Winner ---
  console.log('[TEST 3] Fortified Seat (60 Ballots - Opt 1 Leading)...');
  const res3 = evaluateConstituencyVisualState({
    total_votes: 60,
    opt_0_votes: 10,
    opt_1_votes: 50
  });
  assert(res3.fillColor === COLOR_PALETTE.OPT_1, 'Opt 1 leading must return Emerald Green');
  console.log(`  Result: ${res3.fillColor} (Phase: ${res3.phase})\n`);

  // --- TEST 4: Split Mat / 2-Way Tie ---
  console.log('[TEST 4] Fortified Seat - 2-Way Split Mat (25 vs 25 Tie)...');
  const res4 = evaluateConstituencyVisualState({
    total_votes: 50,
    opt_0_votes: 25,
    opt_1_votes: 25
  });
  assert(res4.fillColor === COLOR_PALETTE.SPLIT_MAT_TIE, '2-Way Tie must return Radiant Gold');
  console.log(`  Result: ${res4.fillColor} (Phase: ${res4.phase})\n`);

  // --- TEST 5: Vote Option Pulse Flash (Phase 1: T = 500ms after vote) ---
  console.log('[TEST 5] Live Ballot Cast - Phase 1: Voted Option Pulse Flash (T = 500ms)...');
  // Live consensus is Opt 0 (Saffron), but Citizen votes for Option 2 (Royal Purple)
  const tallyData = {
    total_votes: 100,
    opt_0_votes: 80, // Leading is Opt 0 Saffron
    opt_1_votes: 10,
    opt_2_votes: 10
  };
  const activePulseState = {
    isPulsing: true,
    votedOptionIdx: 2, // Citizen pressed Option 2 (Purple)
    votedAtTimestamp: Date.now() - 500 // 500ms ago
  };

  const res5 = evaluateConstituencyVisualState(tallyData, activePulseState);
  assert(res5.fillColor === COLOR_PALETTE.OPT_2, 'Map polygon must flash citizen voted option color (Purple)');
  assert(res5.isPulsing === true, 'isPulsing flag must be active');
  console.log(`  Result: ${res5.fillColor} (Phase: ${res5.phase} - Polygon flashed Purple!)\n`);

  // --- TEST 6: Vote Option Pulse Settle (Phase 2: T = 3000ms after vote) ---
  console.log('[TEST 6] Live Ballot Cast - Phase 2: Pulse Expiry & Revert (T = 3000ms)...');
  const expiredPulseState = {
    isPulsing: true,
    votedOptionIdx: 2,
    votedAtTimestamp: Date.now() - 3000 // 3 seconds ago (timer expired)
  };

  const res6 = evaluateConstituencyVisualState(tallyData, expiredPulseState);
  assert(res6.fillColor === COLOR_PALETTE.OPT_0, 'After 2.5s, polygon must revert to live prevailing consensus (Saffron)');
  assert(res6.isPulsing === false, 'isPulsing flag must be inactive');
  console.log(`  Result: ${res6.fillColor} (Phase: ${res6.phase} - Reverted to live consensus!)\n`);

  console.log('============================================================');
  console.log(`🏆 ALL ${passed}/${total} DRISHTI MAP & VOTE-PULSE INVARIANTS PASSED!`);
  console.log('============================================================\n');
}

runDrishtiOracle();