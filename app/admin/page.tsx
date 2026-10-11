'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

interface Poll {
  id: string;
  category: string;
  title_en: string;
  title_hi: string;
  participation_mode?: string;
  recurrence?: string;
  current_cycle?: string;
  starts_at?: string;
  options: any[];
}

const OPTION_PALETTE = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6'];

export default function AdminAuditPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<'AUDIT' | 'CREATE_POLL'>('AUDIT');

  // Polls & Selection
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string>('');

  // Audit Ledger Counts
  const [ballotBoxRows, setBallotBoxRows] = useState<any[]>([]);
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [ballotBoxTotalCount, setBallotBoxTotalCount] = useState<number>(0);
  const [talliesRows, setTalliesRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sandbox Single Test
  const [simSeat, setSimSeat] = useState('Muzaffarpur');
  const [simState, setSimState] = useState('Bihar');
  const [simOption, setSimOption] = useState(0);
  const [simMessage, setSimMessage] = useState('');

  // Table 4 Filter
  const [tallyFilter, setTallyFilter] = useState<'ALL' | 'FORTIFIED' | 'ACTIVE'>('ALL');

  // NEW POLL CREATOR FORM STATE
  const [newCategory, setNewCategory] = useState<'JanMat' | 'LokMat'>('JanMat');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleHi, setNewTitleHi] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<'daily' | 'weekly' | 'monthly' | 'lifetime'>('monthly');
  const [newStartsAt, setNewStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [newOptions, setNewOptions] = useState([
    { text_en: 'Option 1', text_hi: 'विकल्प 1' },
    { text_en: 'Option 2', text_hi: 'विकल्प 2' },
    { text_en: 'Option 3', text_hi: 'विकल्प 3' }
  ]);
  const [createPollStatus, setCreatePollStatus] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'bhumat2026') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid Security Passcode');
    }
  };

  async function fetchPolls() {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .order('starts_at', { ascending: false });

    if (data && !error) {
      setPolls(data);
      if (data.length > 0 && !selectedPollId) {
        setSelectedPollId(data[0].id);
      }
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchPolls();
    }
  }, [isAuthenticated]);

  async function runComprehensiveAudit(pollId: string) {
    if (!pollId) return;
    setLoading(true);

    try {
      // 1. Table 2: Blind Ballot Box (Ordered by cycle_date or default id, without cast_at)
      const { data: ballots, count: bCount } = await supabase
        .from('ballot_box')
        .select('*', { count: 'exact' })
        .eq('poll_id', pollId)
        .order('id', { ascending: false })
        .limit(30);

      setBallotBoxRows(ballots || []);
      setBallotBoxTotalCount(bCount || 0);

      // 2. Table 1: Participations (Gating)
      const { count: pCount } = await supabase
        .from('voter_participations')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', pollId);

      setParticipationsCount(pCount || 0);

      // 3. Table 4: Pre-computed Matrix
      const { data: tallies } = await supabase
        .from('constituency_tallies')
        .select('*')
        .eq('poll_id', pollId)
        .order('total_votes', { ascending: false });

      setTalliesRows(tallies || []);
    } catch (e) {
      console.error('Audit query error:', e);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_participations' }, () => runComprehensiveAudit(selectedPollId))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, selectedPollId]);

  // Execute Simulated Test Vote from Sandbox
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

  const handleResetPollVotes = async () => {
    if (!confirm(`Are you sure you want to reset all test votes for poll ${selectedPollId}?`)) return;

    await supabase.from('ballot_box').delete().eq('poll_id', selectedPollId);
    await supabase.from('voter_participations').delete().eq('poll_id', selectedPollId);
    await supabase.from('constituency_tallies').delete().eq('poll_id', selectedPollId);
    await supabase.from('poll_totals').delete().eq('poll_id', selectedPollId);

    alert('Votes reset to 0.');
    runComprehensiveAudit(selectedPollId);
  };

  // Poll Deploy Handler
  const handleDeployNewPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleEn.trim()) {
      alert('English title is required');
      return;
    }

    setCreatePollStatus('Publishing poll to BhuMat Sovereign Ledger...');

    const newPollId = `poll_${Math.random().toString(36).substring(2, 8)}`;
    const formattedOptions = newOptions.map((opt, idx) => ({
      id: idx,
      text_en: opt.text_en,
      text_hi: opt.text_hi || opt.text_en
    }));

    const payload: any = {
      id: newPollId,
      category: newCategory,
      title_en: newTitleEn,
      title_hi: newTitleHi || newTitleEn,
      options: formattedOptions,
      participation_mode: newRecurrence === 'lifetime' ? 'one_time' : 'recurring',
      recurrence: newRecurrence,
      current_cycle: '2026-10',
      starts_at: new Date(newStartsAt).toISOString(),
      is_active: true,
      target_region_type: 'PAN_INDIA',
      // Explicitly populate legacy NOT-NULL columns
      option_0_en: formattedOptions[0]?.text_en || 'Option 1',
      option_0_hi: formattedOptions[0]?.text_hi || 'विकल्प 1',
      option_1_en: formattedOptions[1]?.text_en || 'Option 2',
      option_1_hi: formattedOptions[1]?.text_hi || 'विकल्प 2',
      option_2_en: formattedOptions[2]?.text_en || null,
      option_2_hi: formattedOptions[2]?.text_hi || null,
      option_3_en: formattedOptions[3]?.text_en || null,
      option_3_hi: formattedOptions[3]?.text_hi || null
    };

    const { error } = await supabase.from('polls').insert([payload]);

    if (error) {
      setCreatePollStatus(`❌ Error deploying poll: ${error.message}`);
    } else {
      setCreatePollStatus(`✓ Poll Successfully Deployed! ID: ${newPollId}`);
      setNewTitleEn('');
      setNewTitleHi('');
      fetchPolls();
      setSelectedPollId(newPollId);
      setTimeout(() => {
        setActiveAdminTab('AUDIT');
        setCreatePollStatus('');
      }, 1500);
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
              BhuMat Sovereign Command & Verification Suite
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Publish verified questions, audit decoupled anonymous ballots, and inspect 543 constituency rollups.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveAdminTab(activeAdminTab === 'AUDIT' ? 'CREATE_POLL' : 'AUDIT')}
              style={{ padding: '8px 16px', backgroundColor: activeAdminTab === 'CREATE_POLL' ? '#0f172a' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              {activeAdminTab === 'CREATE_POLL' ? '← Back to Live Audit' : '＋ Deploy New Poll'}
            </button>
            <button onClick={() => setIsAuthenticated(false)} style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Lock Panel
            </button>
          </div>
        </div>

        {/* TAB 1: NEW POLL DEPLOYMENT STUDIO */}
        {activeAdminTab === 'CREATE_POLL' ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px' }}>
              EDITORIAL STUDIO
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '10px 0 6px 0' }}>Deploy Sovereign Public Opinion Poll</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Configure bilingual questions, options, category track, and recurrence cadence for live feed publishing.
            </p>

            <form onSubmit={handleDeployNewPoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category Track */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  onClick={() => setNewCategory('JanMat')}
                  style={{ padding: '14px', borderRadius: '12px', border: `2px solid ${newCategory === 'JanMat' ? '#059669' : '#e2e8f0'}`, backgroundColor: newCategory === 'JanMat' ? '#ecfdf5' : '#ffffff', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800, color: '#059669', fontSize: '14px' }}>🌆 JanMat Audit (Civic Track)</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Strict cryptographic secret ballot, 50-vote quorum fortification gate.</div>
                </div>

                <div
                  onClick={() => setNewCategory('LokMat')}
                  style={{ padding: '14px', borderRadius: '12px', border: `2px solid ${newCategory === 'LokMat' ? '#d97706' : '#e2e8f0'}`, backgroundColor: newCategory === 'LokMat' ? '#fffbeb' : '#ffffff', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 800, color: '#d97706', fontSize: '14px' }}>🌅 LokMat Debate (Culture & Mat)</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Open public pulse, choice attributed to user profile, early trend unmasking.</div>
                </div>
              </div>

              {/* Titles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Question Title (English) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How do you rate municipal cleanliness in your city?"
                    value={newTitleEn}
                    onChange={(e) => setNewTitleEn(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Question Title (Hindi)</label>
                  <input
                    type="text"
                    placeholder="उदा. आप अपने शहर में नगरपालिका स्वच्छता को कैसे आंकते हैं?"
                    value={newTitleHi}
                    onChange={(e) => setNewTitleHi(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Recurrence & Start Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Recurrence Cadence</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as any)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                  >
                    <option value="monthly">Monthly Cycle (Default JanMat)</option>
                    <option value="weekly">Weekly Cycle</option>
                    <option value="daily">Daily Pulse</option>
                    <option value="lifetime">One-Time Lifetime Vote</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Drop Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Options */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>Poll Options (Up to 4)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: OPTION_PALETTE[idx] }} />
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1} (English)`}
                        value={opt.text_en}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx].text_en = e.target.value;
                          setNewOptions(updated);
                        }}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600 }}
                      />
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1} (Hindi)`}
                        value={opt.text_hi}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx].text_hi = e.target.value;
                          setNewOptions(updated);
                        }}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 600 }}
                      />
                      {newOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewOptions(newOptions.filter((_, i) => i !== idx))}
                          style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setNewOptions([...newOptions, { text_en: `Option ${newOptions.length + 1}`, text_hi: `विकल्प ${newOptions.length + 1}` }])}
                      style={{ padding: '8px 14px', alignSelf: 'flex-start', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ＋ Add Option
                    </button>
                  )}
                </div>
              </div>

              {createPollStatus && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: createPollStatus.startsWith('✓') ? '#ecfdf5' : '#fef2f2', color: createPollStatus.startsWith('✓') ? '#059669' : '#dc2626', fontWeight: 800, fontSize: '13px' }}>
                  {createPollStatus}
                </div>
              )}

              <button
                type="submit"
                style={{ padding: '16px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 900, cursor: 'pointer', marginTop: '10px' }}
              >
                🚀 Publish & Broadcast to 543 Seats
              </button>
            </form>
          </div>
        ) : (
          /* TAB 2: AUDIT & TESTING LEDGER */
          <>
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
              <button onClick={handleResetPollVotes} style={{ padding: '10px 16px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Reset Votes
              </button>
            </div>

            {/* Reconciliation Meters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 1: Participations (Gating)</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>{participationsCount}</div>
                <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>Unique voter tokens registered</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Table 2: Blind Ballot Box</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', marginTop: '6px' }}>{ballotBoxTotalCount}</div>
                <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Anonymous ballots cast</div>
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
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Seats certified (≥ 50 votes)</div>
              </div>
            </div>

            {/* Sandbox Live Ballot Injector */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}>🧪 Sandbox Live Ballot Injector</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Constituency (e.g. Muzaffarpur)"
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

            {/* Table 4: Pre-Computed Matrix */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                  📊 Table 4: Pre-computed Constituency Matrix (`constituency_tallies`)
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setTallyFilter('ALL')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ALL' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ALL' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>All Seats</button>
                  <button onClick={() => setTallyFilter('ACTIVE')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'ACTIVE' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'ACTIVE' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Active (&gt;0)</button>
                  <button onClick={() => setTallyFilter('FORTIFIED')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: tallyFilter === 'FORTIFIED' ? '#0f172a' : '#f1f5f9', color: tallyFilter === 'FORTIFIED' ? '#ffffff' : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Fortified (≥50)</button>
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
                      <th style={{ padding: '10px' }}>Leader</th>
                      <th style={{ padding: '10px' }}>Quorum Met</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTallies.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '18px', textAlign: 'center', color: '#94a3b8' }}>
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
                          <td style={{ padding: '10px', fontWeight: 800 }}>Option {row.leading_option} ({row.leading_votes} v)</td>
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

            {/* Table 2: Cryptographic Decoupled Blind Ballot Box */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                  🔒 Table 2: Cryptographic Blind Ballot Box (`ballot_box`)
                </h3>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '999px' }}>
                  ✓ Side-Channel Immune
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0' }}>
                Notice: Zero high-precision timestamps, zero voter tokens, zero device fingerprints, and zero IP addresses are stored.
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
                          <td style={{ padding: '10px', fontWeight: 800, color: OPTION_PALETTE[b.selected_option % 4] }}>
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
          </>
        )}

      </div>
    </div>
  );
}