'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';
const supabase = createClient(supabaseUrl, rawKey.trim());

interface OptionItem {
  id: number;
  text_en: string;
  text_hi: string;
}

export default function AdminPollManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  // 543 Constituencies List for Granular Multi-Select
  const [allConstituencies, setAllConstituencies] = useState<Array<{ id: string; name: string; state: string }>>([]);
  const [seatFilter, setSeatFilter] = useState('');

  // Form State
  const [pollId, setPollId] = useState(`poll_${Date.now().toString().slice(-4)}`);
  const [category, setCategory] = useState<'JanMat' | 'LokMat'>('JanMat');
  const [titleEn, setTitleEn] = useState('');
  const [titleHi, setTitleHi] = useState('');
  const [participationMode, setParticipationMode] = useState<'one_time' | 'recurring'>('recurring');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [currentCycle, setCurrentCycle] = useState('2026-10');
  const [targetScope, setTargetScope] = useState<'PAN_INDIA' | 'CUSTOM_SEATS'>('PAN_INDIA');
  const [selectedTargetSeats, setSelectedTargetSeats] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));

  const [options, setOptions] = useState<OptionItem[]>([
    { id: 0, text_en: 'Excellent & Well Maintained', text_hi: 'बहुत अच्छी और सुव्यवस्थित' },
    { id: 1, text_en: 'Average / Regular Potholes', text_hi: 'औसत / आए दिन गड्ढे' },
    { id: 2, text_en: 'Severe Deterioration / Unsafe', text_hi: 'बेहद खराब और असुरक्षित' }
  ]);

  // Load 543 Seats List
  useEffect(() => {
    fetch('/india_pc_preprojected.json')
      .then((res) => res.json())
      .then((data) => {
        setAllConstituencies(data.map((d: any) => ({ id: d.id, name: d.name, state: d.state })));
      })
      .catch((e) => console.warn('Could not load seats:', e));
  }, []);

  async function fetchPolls() {
    setLoading(true);
    const { data } = await supabase.from('polls').select('*').order('starts_at', { ascending: false });
    if (data) setPolls(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAuthenticated) fetchPolls();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'bhumat2026') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid Admin Passcode');
    }
  };

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, { id: options.length, text_en: '', text_hi: '' }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index).map((opt, i) => ({ ...opt, id: i }));
    setOptions(updated);
  };

  const toggleTargetSeat = (seatName: string) => {
    setSelectedTargetSeats((prev) =>
      prev.includes(seatName) ? prev.filter((s) => s !== seatName) : [...prev, seatName]
    );
  };

  async function handleToggleActive(p: any) {
    const updated = !p.is_active;
    await supabase.from('polls').update({ is_active: updated }).eq('id', p.id);
    fetchPolls();
  }

  async function handleToggleBlackout(poll: any) {
    const seat = prompt(`Enter Lok Sabha constituency to add/remove from ECI Silence Blackout for ${poll.id}:`);
    if (!seat) return;
    const current = poll.blackout_seats || [];
    const updated = current.includes(seat) ? current.filter((s: string) => s !== seat) : [...current, seat];
    await supabase.from('polls').update({ blackout_seats: updated }).eq('id', poll.id);
    fetchPolls();
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage('Publishing poll to sovereign registry...');

    const payload = {
      id: pollId,
      category,
      title_en: titleEn,
      title_hi: titleHi,
      options,
      option_0_en: options[0]?.text_en || '',
      option_0_hi: options[0]?.text_hi || '',
      option_1_en: options[1]?.text_en || '',
      option_1_hi: options[1]?.text_hi || '',
      option_2_en: options[2]?.text_en || '',
      option_2_hi: options[2]?.text_hi || '',
      recurrence,
      participation_mode: participationMode,
      current_cycle: currentCycle,
      target_region_type: targetScope === 'PAN_INDIA' ? 'PAN_INDIA' : 'CUSTOM_SEATS',
      target_seats: targetScope === 'PAN_INDIA' ? [] : selectedTargetSeats,
      blackout_seats: [],
      starts_at: new Date(startsAt).toISOString(),
      is_active: true
    };

    const { error } = await supabase.from('polls').insert([payload]);

    if (!error) {
      setStatusMessage('✓ Poll published successfully!');
      fetchPolls();
      setPollId(`poll_${Date.now().toString().slice(-4)}`);
      setTitleEn('');
      setTitleHi('');
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      setStatusMessage(`Error: ${error.message}`);
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#ffffff', padding: '36px 32px', borderRadius: '20px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px rgba(0,0,0,0.3)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a', textAlign: 'center' }}>BhuMat Command Auth</h2>
          <input
            type="password"
            placeholder="Enter Sovereign Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
          />
          {authError && <div style={{ color: '#e11d48', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>{authError}</div>}
          <button type="submit" style={{ padding: '12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
            Access Deck 🔒
          </button>
        </form>
      </div>
    );
  }

  const filteredSeats = allConstituencies.filter(
    (c) => c.name.toLowerCase().includes(seatFilter.toLowerCase()) || c.state.toLowerCase().includes(seatFilter.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', padding: '32px 20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>EDITORIAL COMMAND</span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '6px 0 0 0' }}>BhuMat Poll Command Center</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsAuthenticated(false)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Lock Deck</button>
            <a href="/" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#334155', textDecoration: 'none' }}>← View App</a>
          </div>
        </div>

        {/* Create Form */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '32px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>Create Audit (2–4 Options & Recurrence Control)</h2>
          <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Poll Identifier</label>
                <input type="text" required value={pollId} onChange={(e) => setPollId(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Pillar</label>
                <select value={category} onChange={(e: any) => setCategory(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}>
                  <option value="JanMat">JanMat (Civic Audit / 8 PM - Emerald)</option>
                  <option value="LokMat">LokMat (Culture Poll / 8 AM - Amber)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>⏰ Go-Live Time</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '9px', borderRadius: '8px', border: '1.5px solid #38bdf8', backgroundColor: '#f0f9ff' }} />
              </div>
            </div>

            {/* Recurrence & Cadence Settings */}
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Participation Type</label>
                <select value={participationMode} onChange={(e: any) => setParticipationMode(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, marginTop: '4px' }}>
                  <option value="recurring">Recurring (Resets Each Cycle)</option>
                  <option value="one_time">One-Time Ballot (Permanent)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Recurrence Frequency</label>
                <select disabled={participationMode === 'one_time'} value={recurrence} onChange={(e: any) => setRecurrence(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, marginTop: '4px' }}>
                  <option value="daily">Daily Reset (24 Hours)</option>
                  <option value="weekly">Weekly Cycle (Monday Drop)</option>
                  <option value="monthly">Monthly Cycle (1st of Month)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Current Cycle Code</label>
                <input type="text" value={currentCycle} onChange={(e) => setCurrentCycle(e.target.value)} placeholder="e.g. 2026-10" style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, marginTop: '4px' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Question (English)</label>
              <input type="text" required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Question (Hindi)</label>
              <input type="text" required value={titleHi} onChange={(e) => setTitleHi(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>

            {/* Options */}
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Ballot Options ({options.length}/4)</span>
                {options.length < 4 && (
                  <button type="button" onClick={handleAddOption} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    + Add Option
                  </button>
                )}
              </div>
              {options.map((opt, idx) => (
                <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${idx + 1} (English)`}
                    value={opt.text_en}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[idx].text_en = e.target.value;
                      setOptions(updated);
                    }}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder={`विकल्प ${idx + 1} (हिन्दी)`}
                    value={opt.text_hi}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[idx].text_hi = e.target.value;
                      setOptions(updated);
                    }}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(idx)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Scope */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>
                  <input type="radio" checked={targetScope === 'PAN_INDIA'} onChange={() => setTargetScope('PAN_INDIA')} /> 🇮🇳 PAN India (All 543 Seats)
                </label>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>
                  <input type="radio" checked={targetScope === 'CUSTOM_SEATS'} onChange={() => setTargetScope('CUSTOM_SEATS')} /> 🎯 Hand-Pick Constituencies ({selectedTargetSeats.length} selected)
                </label>
              </div>

              {targetScope === 'CUSTOM_SEATS' && (
                <div>
                  <input
                    type="text"
                    placeholder="Search 543 seats to add..."
                    value={seatFilter}
                    onChange={(e) => setSeatFilter(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid #a7f3d0', marginBottom: '8px', fontSize: '12px' }}
                  />
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {filteredSeats.slice(0, 40).map((seat) => {
                      const isChecked = selectedTargetSeats.includes(seat.name);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => toggleTargetSeat(seat.name)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: isChecked ? '1px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: isChecked ? '#ecfdf5' : '#f8fafc',
                            color: isChecked ? '#065f46' : '#475569',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isChecked ? '✓ ' : '+ '} {seat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>{statusMessage}</span>
              <button type="submit" style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                + Publish Ballot
              </button>
            </div>
          </form>
        </div>

        {/* Refined Active Polls & Blackouts Section */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Active Polls & ECI Blackout Windows</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Manage live visibility and constituency election silence</p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>{polls.length} Registered</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {polls.map((p) => {
              const isJanMat = p.category === 'JanMat';
              const blackouts = p.blackout_seats || [];
              const isLive = p.is_active && new Date(p.starts_at) <= new Date();

              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ maxWidth: '65%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ backgroundColor: isJanMat ? '#ecfdf5' : '#fffbeb', color: isJanMat ? '#059669' : '#d97706', border: `1px solid ${isJanMat ? '#a7f3d0' : '#fde68a'}`, fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>
                        {p.category}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{p.id}</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: isLive ? '#10b981' : '#94a3b8' }}>
                        {isLive ? '● LIVE' : '○ INACTIVE'}
                      </span>
                      <span style={{ fontSize: '10px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {p.participation_mode === 'recurring' ? `${p.recurrence} (${p.current_cycle})` : 'One-Time'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>{p.title_en}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Scope: {p.target_region_type} • {p.options?.length || 3} Options • Blackout: {blackouts.length} Seats
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleBlackout(p)}
                      style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ECI Silence ({blackouts.length})
                    </button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      style={{
                        backgroundColor: p.is_active ? '#fee2e2' : '#ecfdf5',
                        border: `1px solid ${p.is_active ? '#fca5a5' : '#a7f3d0'}`,
                        color: p.is_active ? '#dc2626' : '#059669',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}