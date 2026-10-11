'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  options: any[];
}

export default function AdminAuditPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string>('');

  // Core Audit Counts
  const [ballotBoxRows, setBallotBoxRows] = useState<any[]>([]);
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [ballotBoxTotalCount, setBallotBoxTotalCount] = useState<number>(0);
  const [talliesRows, setTalliesRows] = useState<any[]>([]);
  const [pollTotalsCount, setPollTotalsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Single Sandbox Test Form
  const [simSeat, setSimSeat] = useState('Darbhanga');
  const [simState, setSimState] = useState('Bihar');
  const [simOption, setSimOption] = useState(0);
  const [simMessage, setSimMessage] = useState('');

  // Batch Stress-Test Form
  const [batchSeat, setBatchSeat] = useState('Muzaffarpur');
  const [batchState, setBatchState] = useState('Bihar');
  const [batchScenario, setBatchScenario] = useState<'FORTIFY_LEADER' | 'TIE_25_25' | 'EDGE_49'>('FORTIFY_LEADER');
  const [batchMessage, setBatchMessage] = useState('');

  // Table 4 Filter
  const [tallyFilter, setTallyFilter] = useState<'ALL' | 'FORTIFIED' | 'ACTIVE'>('ALL');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'bhumat2026') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid Security Passcode');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchPolls() {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('starts_at', { ascending: false });

      if (data && !error) {
        setPolls(data);
        if (data.length > 0) {
          setSelectedPollId(data[0].id);
        }
      }
    }
    fetchPolls();
  }, [isAuthenticated]);

  async function runComprehensiveAudit(pollId: string) {
    if (!pollId) return;
    setLoading(true);

    try {
      // 1. Table 2: Blind Ballot Box (Without Precise Timestamp)
      const { data: ballots, count: bCount } = await supabase
        .from('ballot_box')
        .select('*', { count: 'exact' })
        .eq('poll_id', pollId)
        .order('cycle_date', { ascending: false })
        .limit(25);

      setBallotBoxRows(ballots || []);
      setBallotBoxTotalCount(bCount || 0);

      // 2. Table 1: Participations (Gating)
      const { count: pCount } = await supabase
        .from('voter_participations')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', pollId);

      setParticipationsCount(pCount || 0);

      // 3. Table 3: Total Audit Counter
      const { data: pTotal } = await supabase
        .from('poll_totals')
        .select('total_votes')
        .eq('poll_id', pollId)
        .maybeSingle();

      setPollTotalsCount(Number(pTotal?.total_votes || bCount || 0));

      // 4. Table 4: Pre-computed Matrix
      const { data: tallies } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId)
        .order('total_votes', { ascending: false });

      setTalliesRows(tallies || []);
    } catch (e) {
      console.error('Audit query note:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && selectedPollId) {
      runComprehensiveAudit(selectedPollId);

      const channel = supabase
        .channel(`admin_audit_unified_${selectedPollId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ballot_box' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'constituency_tallies' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_participations' }, () => runComprehensiveAudit(selectedPollId))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, selectedPollId]);

  // Single Sandbox Test Ballot
  const handleSimulateBallot = async () => {
    setSimMessage('Casting simulated ballot...');
    const fakeToken = 'sim_' + Math.random().toString(36).substring(2, 10);

    const { data, error } = await supabase.rpc('cast_ballot_transaction', {
      p_poll_id: selectedPollId,
      p_cycle_id: '2026-10',
      p_voter_token: fakeToken,
      p_state_name: simState,
      p_constituency_name: simSeat,
      p_selected_option: Number(simOption)
    });

    if (error || !data?.success) {
      setSimMessage(`❌ Error: ${error?.message || data?.error}`);
    } else {
      setSimMessage(`✓ Ballot Logged: Seat total is now ${data.constituency_total}. Total audit ledger is ${data.total_poll_votes}.`);
      runComprehensiveAudit(selectedPollId);
    }
  };

  // Batch Quorum Scenario Injection
  const handleBatchSimulation = async () => {
    setBatchMessage('Executing batch scenario...');

    let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
    if (batchScenario === 'FORTIFY_LEADER') {
      // 52 total votes (32 for Option 0, 20 for Option 1 -> Certified Orange)
      c0 = 32;
      c1 = 20;
    } else if (batchScenario === 'TIE_25_25') {
      // Exact 50-vote tie (25 Option 0 vs 25 Option 1 -> Certified Split Tie)
      c0 = 25;
      c1 = 25;
    } else if (batchScenario === 'EDGE_49') {
      // 49 votes (1 vote shy of quorum -> Must stay neutral slate)
      c0 = 29;
      c1 = 20;
    }

    const { data, error } = await supabase.rpc('simulate_batch_quorum', {
      p_poll_id: selectedPollId,
      p_cycle_id: '2026-10',
      p_state_name: batchState,
      p_constituency_name: batchSeat,
      p_opt_0_count: c0,
      p_opt_1_count: c1,
      p_opt_2_count: c2,
      p_opt_3_count: c3
    });

    if (error || !data?.success) {
      setBatchMessage(`❌ Failed: ${error?.message}`);
    } else {
      setBatchMessage(`✓ Injected ${data.total_added} ballots into ${batchSeat} under scenario: ${batchScenario}.`);
      runComprehensiveAudit(selectedPollId);
    }
  };

  // 1-Click Clean Slate Reset
  const handleResetPollVotes = async () => {
    if (!confirm(`Reset all votes for poll ${selectedPollId}? This clears ballot_box and constituency_tallies for this poll.`)) return;

    await supabase.from('ballot_box').delete().eq('poll_id', selectedPollId);
    await supabase.from('voter_participations').delete().eq('poll_id', selectedPollId);
    await supabase.from('constituency_tallies').delete().eq('poll_id', selectedPollId);
    await supabase.from('poll_totals').delete().eq('poll_id', selectedPollId);

    alert('Poll votes reset to 0.');
    runComprehensiveAudit(selectedPollId);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '32px', borderRadius: '16px', width: '320px', border: '1px solid #334155' }}>
          <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>BhuMat Audit Portal</h2>
          <input
            type="password"
            placeholder="Enter security key..."
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', marginBottom: '14px', outline: 'none' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
            Unlock Audit Ledger
          </button>
        </form>
      </div>
    );
  }

  const selectedPoll = polls.find((p) => p.id === selectedPollId);
  const isLedgerReconciled = ballotBoxTotalCount === participationsCount;
  const fortifiedSeatsCount = talliesRows.filter((r) => r.is_fortified || r.total_votes >= 50).length;

  const filteredTallies = talliesRows.filter((r) => {
    if (tallyFilter === 'FORTIFIED') return r.is_fortified || r.total_votes >= 50;
    if (tallyFilter === 'ACTIVE') return r.total_votes > 0;
    return true;
  });

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', padding: '24px', fontFamily: 'system-ui', color: '#0f172a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              BhuMat Sovereign Audit & Verification Suite
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Side-channel immune audit suite: Blind ballots, independent totals, and pre-computed matrix.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleResetPollVotes} style={{ padding: '8px 14px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              🗑️ Reset Poll Ballots
            </button>
            <button onClick={() => setIsAuthenticated(false)} style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Lock Panel
            </button>
          </div>
        </div>

        {/* Target Poll Selector */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 800 }}>Audit Poll Target:</label>
          <select
            value={selectedPollId}
            onChange={(e) => setSelectedPollId(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #0284c7', fontWeight: 700, fontSize: '13px', backgroundColor: '#f0f9ff' }}
          >
            {polls.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.title_en} ({p.id})
              </option>
            ))}
          </select>
          <button onClick={() => runComprehensiveAudit(selectedPollId)} style={{ padding: '10px 16px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Triple-Entry Meter with Quorum Radar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 1: Participations (Gating)</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>{participationsCount}</div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>Unique voter tokens registered</div>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 2: Blind Ballot Box</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>{ballotBoxTotalCount}</div>
            <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Decoupled anonymous ballots</div>
          </div>

          <div style={{ backgroundColor: isLedgerReconciled ? '#ecfdf5' : '#fef2f2', padding: '16px', borderRadius: '14px', border: `1.5px solid ${isLedgerReconciled ? '#a7f3d0' : '#fecaca'}` }}>
            <div style={{ fontSize: '10px', color: isLedgerReconciled ? '#065f46' : '#991b1b', textTransform: 'uppercase', fontWeight: 800 }}>Reconciliation Status</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: isLedgerReconciled ? '#059669' : '#dc2626', marginTop: '8px' }}>
              {isLedgerReconciled ? '✓ 100% Reconciled' : '⚠ Discrepancy Found'}
            </div>
            <div style={{ fontSize: '11px', color: isLedgerReconciled ? '#047857' : '#b91c1c', marginTop: '4px' }}>
              {ballotBoxTotalCount} ballots == {participationsCount} tokens
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Pan-Bharat Quorum Radar</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: fortifiedSeatsCount > 0 ? '#10b981' : '#64748b', marginTop: '6px' }}>
              {fortifiedSeatsCount} / 543
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Seats certified ($\ge 50$ votes)</div>
          </div>
        </div>

        {/* Batch Quorum Scenario Stress-Tester */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1.5px solid #0284c7', marginBottom: '24px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0284c7' }}>
              🚀 Batch Quorum Scenario Stress-Tester
            </h3>
            <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              End-to-End Edge Validator
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
            Simulate realistic multi-vote cascades to verify whether choropleth map regions unmask, stay neutral, or enter tie-breaks instantly.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr auto', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Constituency (e.g. Muzaffarpur)"
              value={batchSeat}
              onChange={(e) => setBatchSeat(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <input
              type="text"
              placeholder="State (e.g. Bihar)"
              value={batchState}
              onChange={(e) => setBatchState(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <select
              value={batchScenario}
              onChange={(e) => setBatchScenario(e.target.value as any)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            >
              <option value="FORTIFY_LEADER">Fortify Quorum (52 Ballots: 32 Opt 0 vs 20 Opt 1)</option>
              <option value="TIE_25_25">Exact Quorum Tie (50 Ballots: 25 Opt 0 vs 25 Opt 1)</option>
              <option value="EDGE_49">Sub-Quorum Boundary (49 Ballots: 29 Opt 0 vs 20 Opt 1)</option>
            </select>
            <button
              onClick={handleBatchSimulation}
              style={{ padding: '10px 18px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Inject Scenario
            </button>
          </div>
          {batchMessage && (
            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: batchMessage.startsWith('✓') ? '#059669' : '#dc2626' }}>
              {batchMessage}
            </div>
          )}
        </div>

        {/* Single Sandbox Ballot Form */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 10px 0' }}>🧪 Single Ballot Injector</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr auto', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Constituency (e.g. Buxar)"
              value={simSeat}
              onChange={(e) => setSimSeat(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <input
              type="text"
              placeholder="State (e.g. Bihar)"
              value={simState}
              onChange={(e) => setSimState(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <select
              value={simOption}
              onChange={(e) => setSimOption(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            >
              {selectedPoll?.options?.map((opt: any, idx: number) => (
                <option key={opt.id || idx} value={idx}>
                  Option {idx}: {opt.text_en}
                </option>
              ))}
            </select>
            <button
              onClick={handleSimulateBallot}
              style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              Cast Single
            </button>
          </div>
          {simMessage && (
            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 700, color: simMessage.startsWith('✓') ? '#059669' : '#dc2626' }}>
              {simMessage}
            </div>
          )}
        </div>

        {/* Table 4: Pre-Computed Matrix */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
              📊 Table 4: Pre-computed Constituency Matrix (`constituency_tallies`)
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setTallyFilter('ALL')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ALL' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ALL' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>All Seats</button>
              <button onClick={() => setTallyFilter('ACTIVE')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ACTIVE' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ACTIVE' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Active (&gt;0)</button>
              <button onClick={() => setTallyFilter('FORTIFIED')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'FORTIFIED' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'FORTIFIED' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Fortified (&ge;50)</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px' }}>Constituency</th>
                  <th style={{ padding: '10px' }}>State</th>
                  <th style={{ padding: '10px' }}>Total Votes</th>
                  <th style={{ padding: '10px' }}>Opt 0 (Orange)</th>
                  <th style={{ padding: '10px' }}>Opt 1 (Green)</th>
                  <th style={{ padding: '10px' }}>Opt 2 (Sky Blue)</th>
                  <th style={{ padding: '10px' }}>Opt 3 (Purple)</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTallies.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                      No seats matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredTallies.map((row) => (
                    <tr key={`${row.constituency_name}-${row.state_name}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 800 }}>{row.constituency_name}</td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{row.state_name}</td>
                      <td style={{ padding: '10px', fontWeight: 900, color: '#0284c7' }}>{row.total_votes}</td>
                      <td style={{ padding: '10px', color: '#f97316', fontWeight: 700 }}>{row.opt_0_votes}</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: 700 }}>{row.opt_1_votes}</td>
                      <td style={{ padding: '10px', color: '#0ea5e9', fontWeight: 700 }}>{row.opt_2_votes}</td>
                      <td style={{ padding: '10px', color: '#8b5cf6', fontWeight: 700 }}>{row.opt_3_votes}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: row.is_fortified ? '#ecfdf5' : '#fef3c7', color: row.is_fortified ? '#059669' : '#d97706' }}>
                          {row.is_fortified ? `✓ FORTIFIED (Opt ${row.leading_option})` : `⏳ ${row.total_votes}/50`}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Cryptographic Decoupled Blind Ballot Box (ZERO TIMESTAMP LINKAGE) */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
              🔒 Table 2: Decoupled Blind Ballot Box (`ballot_box`)
            </h3>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '999px' }}>
              ✓ Side-Channel Immune
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0' }}>
            Audit verification: Notice zero high-precision timestamps, zero voter tokens, zero device fingerprints, and zero IP addresses are stored. Temporal linkage attacks are mathematically neutralized.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px' }}>Ballot UUID</th>
                  <th style={{ padding: '10px' }}>Constituency</th>
                  <th style={{ padding: '10px' }}>State</th>
                  <th style={{ padding: '10px' }}>Selected Option</th>
                  <th style={{ padding: '10px' }}>Batch Cycle</th>
                </tr>
              </thead>
              <tbody>
                {ballotBoxRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                      Ballot box is currently empty.
                    </td>
                  </tr>
                ) : (
                  ballotBoxRows.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{b.id}</td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{b.constituency_name}</td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{b.state_name}</td>
                      <td style={{ padding: '10px', fontWeight: 800, color: ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'][b.selected_option % 4] }}>
                        Option {b.selected_option}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>{b.cycle_date || 'Daily Batch'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}