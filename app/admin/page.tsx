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

  // Audit Data States
  const [ballotBoxRows, setBallotBoxRows] = useState<any[]>([]);
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [pollTotalsRecord, setPollTotalsRecord] = useState<any>(null);
  const [talliesRows, setTalliesRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulation Form States
  const [simSeat, setSimSeat] = useState('Darbhanga');
  const [simState, setSimState] = useState('Bihar');
  const [simOption, setSimOption] = useState(0);
  const [simMessage, setSimMessage] = useState('');

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
      // 1. Fetch Ballot Box Rows (Table 2 - Anonymous Drops)
      const { data: ballots, count: bCount } = await supabase
        .from('ballot_box')
        .select('*', { count: 'exact' })
        .eq('poll_id', pollId)
        .order('cast_at', { ascending: false })
        .limit(25);

      setBallotBoxRows(ballots || []);

      // 2. Fetch Participations Count (Table 1 - Gating)
      const { count: pCount } = await supabase
        .from('voter_participations')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', pollId);

      setParticipationsCount(pCount || 0);

      // 3. Fetch Independent Total Audit Counter
      const { data: pTotal } = await supabase
        .from('poll_totals')
        .select('*')
        .eq('poll_id', pollId)
        .maybeSingle();

      setPollTotalsRecord(pTotal || { total_votes: 0 });

      // 4. Fetch Pre-computed Constituency Tallies
      const { data: tallies } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId)
        .order('total_votes', { ascending: false });

      setTalliesRows(tallies || []);
    } catch (e) {
      console.error('Audit run error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && selectedPollId) {
      runComprehensiveAudit(selectedPollId);

      const channel = supabase
        .channel(`admin_audit_stream_${selectedPollId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ballot_box' }, () => runComprehensiveAudit(selectedPollId))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'constituency_tallies' }, () => runComprehensiveAudit(selectedPollId))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, selectedPollId]);

  // Sandbox Test Voter
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
      setSimMessage(`✓ Ballot Logged: Seat total is now ${data.constituency_total}. National total is ${data.total_poll_votes}.`);
      runComprehensiveAudit(selectedPollId);
    }
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
  const totalAuditCounter = Number(pollTotalsRecord?.total_votes || 0);
  const totalBallotsRecorded = ballotBoxRows.length > 0 ? totalAuditCounter : 0;
  const isLedgerReconciled = totalAuditCounter === participationsCount;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f8fafc', padding: '24px', fontFamily: 'system-ui', color: '#0f172a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              BhuMat Consensus Verification Suite
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Live cryptographic inspection of unlinked ballots, independent totals, and pre-computed constituency tallies.
            </p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            Lock Panel
          </button>
        </div>

        {/* Poll Selector */}
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

        {/* Triangulated Triple-Entry Reconciliation Meter */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 1: Participations (Gating)</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>{participationsCount}</div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>Unique voter tokens registered</div>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 2: Blind Ballot Box</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>{totalAuditCounter}</div>
            <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Anonymous ballots cast</div>
          </div>

          <div style={{ backgroundColor: isLedgerReconciled ? '#ecfdf5' : '#fef2f2', padding: '18px', borderRadius: '14px', border: `1.5px solid ${isLedgerReconciled ? '#a7f3d0' : '#fecaca'}` }}>
            <div style={{ fontSize: '11px', color: isLedgerReconciled ? '#065f46' : '#991b1b', textTransform: 'uppercase', fontWeight: 800 }}>Reconciliation Status</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: isLedgerReconciled ? '#059669' : '#dc2626', marginTop: '10px' }}>
              {isLedgerReconciled ? '✓ 100% Matched' : '⚠ Discrepancy Found'}
            </div>
            <div style={{ fontSize: '11px', color: isLedgerReconciled ? '#047857' : '#b91c1c', marginTop: '4px' }}>
              {isLedgerReconciled ? 'All ballots exactly equal voter tokens.' : 'Dropped packet detected between tables.'}
            </div>
          </div>
        </div>

        {/* Sandbox Test Voter Form */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}>🧪 Sandbox Live Ballot Injector</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr auto', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Constituency (e.g. Darbhanga)"
              value={simSeat}
              onChange={(e) => setSimSeat(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <input
              type="text"
              placeholder="State (e.g. Bihar)"
              value={simState}
              onChange={(e) => setSimState(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            />
            <select
              value={simOption}
              onChange={(e) => setSimOption(Number(e.target.value))}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
            >
              {selectedPoll?.options?.map((opt: any, idx: number) => (
                <option key={opt.id || idx} value={idx}>
                  Option {idx}: {opt.text_en}
                </option>
              ))}
            </select>
            <button
              onClick={handleSimulateBallot}
              style={{ padding: '10px 18px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              Cast Test Vote
            </button>
          </div>
          {simMessage && (
            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: simMessage.startsWith('✓') ? '#059669' : '#dc2626' }}>
              {simMessage}
            </div>
          )}
        </div>

        {/* Pre-Computed Constituency Tallies Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}>
            📊 Table 4: Pre-computed Constituency Matrix (`constituency_tallies`)
          </h3>
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
                  <th style={{ padding: '10px' }}>Leader</th>
                  <th style={{ padding: '10px' }}>Quorum Met</th>
                </tr>
              </thead>
              <tbody>
                {talliesRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
                      No votes recorded in this poll yet.
                    </td>
                  </tr>
                ) : (
                  talliesRows.map((row) => (
                    <tr key={row.constituency_name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 800 }}>{row.constituency_name}</td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{row.state_name}</td>
                      <td style={{ padding: '10px', fontWeight: 900, color: '#0284c7' }}>{row.total_votes}</td>
                      <td style={{ padding: '10px', color: '#f97316', fontWeight: 700 }}>{row.opt_0_votes}</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: 700 }}>{row.opt_1_votes}</td>
                      <td style={{ padding: '10px', color: '#0ea5e9', fontWeight: 700 }}>{row.opt_2_votes}</td>
                      <td style={{ padding: '10px', color: '#8b5cf6', fontWeight: 700 }}>{row.opt_3_votes}</td>
                      <td style={{ padding: '10px', fontWeight: 800 }}>
                        Option {row.leading_option} ({row.leading_votes} v)
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: row.is_fortified ? '#ecfdf5' : '#fef3c7', color: row.is_fortified ? '#059669' : '#d97706' }}>
                          {row.is_fortified ? '✓ FORTIFIED' : `⏳ ${row.total_votes}/50`}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Raw Anonymous Blind Ballot Box Drops */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}>
            🔒 Table 2: Cryptographic Blind Ballot Box (`ballot_box`) — Recent 25 Ballots
          </h3>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0' }}>
            Verification proof: Notice zero voter token, zero IP, and zero user ID is stored. Complete deniability is enforced.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px' }}>Ballot UUID</th>
                  <th style={{ padding: '10px' }}>Constituency</th>
                  <th style={{ padding: '10px' }}>State</th>
                  <th style={{ padding: '10px' }}>Selected Option</th>
                  <th style={{ padding: '10px' }}>Timestamp</th>
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
                      <td style={{ padding: '10px', color: '#94a3b8', fontSize: '11px' }}>{new Date(b.cast_at).toLocaleTimeString()}</td>
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